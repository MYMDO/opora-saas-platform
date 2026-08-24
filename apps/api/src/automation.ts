import type { DataPort, Json } from '@opora/data-runtime';
import type { MetadataPort } from '@opora/metadata';
import { matchWorkflows, executeWorkflow } from '@opora/workflow';
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

    return report;
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
        const runStatus = result.ok ? 'ok' : 'error';
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
