import type { DataPort, Json } from '@opora/data-runtime';
import type { MetadataPort } from '@opora/metadata';
import { matchWorkflows, executeWorkflow, conditionMatches } from '@opora/workflow';
import type { WorkflowRunsPort } from './runs';

export interface PendingEvent {
  id: string;
  tenantId: string;
  appSlug: string;
  eventType: string;
  payload: Record<string, Json>;
}

export interface OutboxDrainPort {
  pending(limit: number): Promise<PendingEvent[]>;
  /** Тенанти з будь-якою історією подій (для schedule-оцінки без нових подій). */
  tenants(): Promise<string[]>;
  markProcessed(id: string, status: 'done' | 'skipped' | 'error', error?: string): Promise<void>;
}

export interface AutomationDeps {
  metadata: MetadataPort;
  data: DataPort;
  outbox: OutboxDrainPort;
  runs: WorkflowRunsPort;
  resolveConnection(connection: string): string | null;
  webhookPost(url: string, body: unknown): Promise<{ ok: boolean; status?: number; error?: string }>;
  log?(line: string): void;
}

export interface DrainReport {
  processed: number;
  ok: number;
  skipped: number;
  error: number;
}

const BATCH = 25;

export class AutomationService {
  constructor(private readonly deps: AutomationDeps) {}

  private log(line: string): void {
    this.deps.log?.(line);
  }

  /**
   * Дренує партію подій outbox і виконує відповідні workflow.
   * Ідемпотентність: ключ `${outboxId}#${index}` — повторний дрен не виконає
   * той самий workflow двічі. Події `updated` свідомо пропускаються
   * (захист від циклів assign→update→trigger).
   */
  async drain(): Promise<DrainReport> {
    const report: DrainReport = { processed: 0, ok: 0, skipped: 0, error: 0 };
    const pending = await this.deps.outbox.pending(BATCH);

    for (const event of pending) {
      try {
        await this.processOne(event, report);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log(`event ${event.id}: ${msg}`);
        await this.safeMark(event.id, 'error', msg);
        report.error += 1;
        report.processed += 1;
      }
    }

    await this.evaluateSchedules(report);

    return report;
  }

  /**
   * Проактивні сторожі: schedule-workflows оцінюють агрегати (sum за групами)
   * для тенантів з історією подій, без привʼязки до нових подій.
   * Троттлінг — добовий бакет у ключі ідемпотентності: один алерт на групу в день.
   */
  private async evaluateSchedules(report: DrainReport): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    let tenants: string[] = [];
    try {
      tenants = await this.deps.outbox.tenants();
    } catch (e) {
      this.log(`schedule tenants failed: ${String(e)}`);
      return;
    }
    if (tenants.length === 0) return;

    let apps: Awaited<ReturnType<MetadataPort['listApps']>> = [];
    try {
      apps = await this.deps.metadata.listApps();
    } catch (e) {
      this.log(`schedule listApps failed: ${String(e)}`);
      return;
    }

    for (const app of apps) {
      let active: Awaited<ReturnType<MetadataPort['getActive']>> = null;
      try {
        active = await this.deps.metadata.getActive(app.slug);
      } catch {
        active = null;
      }
      if (!active) continue;
      const scheduled = active.definition.workflows
        .map((wf, index) => ({ wf, index }))
        .filter(({ wf }) => wf.on === 'schedule' && wf.aggregate !== undefined);
      if (scheduled.length === 0) continue;

      for (const tenantId of tenants) {
        for (const { wf, index } of scheduled) {
          const agg = wf.aggregate;
          if (!agg) continue;
          const entityDef =
            active.definition.entities.find((e) => e.apiName === agg.entity) ?? null;
          if (!entityDef) continue;
          let groups: Array<{ value: string | number | boolean | null; count: number; sum: number | null }> = [];
          try {
            groups = await this.deps.data.aggregate(
              { tenantId, appSlug: app.slug, actorId: null },
              entityDef,
              { groupBy: agg.groupBy, sumBy: agg.sum },
            );
          } catch (e) {
            this.log(`schedule aggregate failed: ${String(e)}`);
            continue;
          }
          for (const g of groups) {
            const recordData: Record<string, Json> = {
              group: g.value as Json,
              sum: g.sum as Json,
            };
            let verdict: boolean | null = null;
            try {
              verdict = wf.if === undefined ? true : conditionMatches(wf.if, recordData);
            } catch {
              verdict = null;
            }
            if (verdict !== true) continue;
            const key = `schedule:${app.slug}:${index}:${typeof g.value}:${String(g.value)}:${today}`;
            let started = false;
            try {
              started = await this.deps.runs.tryStart(key, { tenantId, workflowOn: 'schedule' });
            } catch (e) {
              this.log(`schedule tryStart failed: ${String(e)}`);
              continue;
            }
            if (!started) continue;
            try {
              const result = await executeWorkflow(wf, recordData, {
                resolveConnection: (connection) => this.deps.resolveConnection(connection),
                webhookPost: (url, body) => this.deps.webhookPost(url, body),
                applyRecordPatch: async () => {
                  throw new Error('schedule без запису: assign недоступний');
                },
                log: (s) => this.log(`schedule step: ${JSON.stringify(s)}`),
              });
              const failedStep = result.steps.find((s) => s.status === 'error');
              const allSkipped =
                result.steps.length > 0 && result.steps.every((s) => s.status === 'skipped');
              const runStatus = result.ok ? (allSkipped ? 'skipped' : 'ok') : 'error';
              await this.deps.runs.finish(key, runStatus, failedStep?.detail);
              report[runStatus] += 1;
              report.processed += 1;
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              await this.deps.runs.finish(key, 'error', msg);
              report.error += 1;
              report.processed += 1;
            }
          }
        }
      }
    }
  }

  private async processOne(event: PendingEvent, report: DrainReport): Promise<void> {
    const dotIdx = event.eventType.lastIndexOf('.');
    const entity = dotIdx > 0 ? event.eventType.slice(0, dotIdx) : '';
    const action = dotIdx > 0 ? event.eventType.slice(dotIdx + 1) : '';

    if (!entity || (action !== 'created' && action !== 'deleted')) {
      await this.safeMark(event.id, 'skipped', 'unsupported_event_type');
      report.skipped += 1;
      report.processed += 1;
      return;
    }
    if (!event.appSlug) {
      await this.safeMark(event.id, 'skipped', 'no_app_slug');
      report.skipped += 1;
      report.processed += 1;
      return;
    }

    let active: Awaited<ReturnType<MetadataPort['getActive']>> = null;
    try {
      active = await this.deps.metadata.getActive(event.appSlug);
    } catch {
      active = null;
    }
    if (!active) {
      await this.safeMark(event.id, 'skipped', 'no_published_definition');
      report.skipped += 1;
      report.processed += 1;
      return;
    }

    const entityDef = active.definition.entities.find((e) => e.apiName === entity) ?? null;
    if (!entityDef) {
      await this.safeMark(event.id, 'skipped', 'entity_removed_from_schema');
      report.skipped += 1;
      report.processed += 1;
      return;
    }

    // Знімок запису: для deleted події дані вже недоступні (soft-delete приховує)
    let recordData: Record<string, unknown> | null = null;
    const recordId = String(event.payload.recordId ?? '');
    if (recordId && action !== 'deleted') {
      try {
        const rec = await this.deps.data.get(
          { tenantId: event.tenantId, appSlug: event.appSlug, actorId: null },
          entityDef,
          recordId,
        );
        recordData = rec?.data ?? null;
      } catch {
        recordData = null;
      }
    }

    const matched = matchWorkflows(active.definition, {
      entity,
      action: action as 'created' | 'deleted',
    });

    if (matched.length === 0) {
      await this.safeMark(event.id, 'done');
      report.processed += 1;
      return;
    }

    for (const [index, wf] of matched.entries()) {
      const idempotencyKey = `${event.id}#${index}`;
      const started = await this.deps.runs.tryStart(idempotencyKey, {
        tenantId: event.tenantId,
        workflowOn: wf.on,
      });
      if (!started) continue;

      try {
        const result = await executeWorkflow(wf, recordData, {
          resolveConnection: (connection) => this.deps.resolveConnection(connection),
          webhookPost: (url, body) => this.deps.webhookPost(url, body),
          applyRecordPatch: async (patch) => {
            if (!recordId) throw new Error('немає recordId');
            await this.deps.data.update(
              { tenantId: event.tenantId, appSlug: event.appSlug, actorId: null },
              entityDef,
              recordId,
              patch,
            );
          },
        });

        const failedStep = result.steps.find((s) => s.status === 'error');
        const allSkipped = result.steps.length > 0 && result.steps.every((s) => s.status === 'skipped');
        const runStatus = result.ok ? (allSkipped ? 'skipped' : 'ok') : 'error';
        await this.deps.runs.finish(idempotencyKey, runStatus, failedStep?.detail);
        await this.safeMark(
          event.id,
          result.ok ? 'done' : 'error',
          failedStep?.detail ?? `workflow v${index} ${runStatus}`,
        );
        report[runStatus] += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.deps.runs.finish(idempotencyKey, 'error', msg);
        await this.safeMark(event.id, 'error', msg);
        report.error += 1;
      }
      report.processed += 1;
    }
  }

  private async safeMark(
    id: string,
    status: 'done' | 'skipped' | 'error',
    error?: string,
  ): Promise<void> {
    try {
      await this.deps.outbox.markProcessed(id, status, error);
    } catch (e) {
      this.log(`markProcessed(${id}) failed: ${String(e)}`);
    }
  }
}
