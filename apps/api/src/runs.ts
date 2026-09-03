import type { D1Executor, Json, OutboxEvent } from '@opora/data-runtime';

/* ------------------------------ контракти ------------------------------ */

export interface WorkflowRunRow {
  idempotencyKey: string;
  tenantId: string;
  workflowOn: string;
  status: 'running' | 'ok' | 'error' | 'skipped';
  error?: string | null;
  createdAt: string;
  finishedAt?: string | null;
}

export interface WorkflowRunsPort {
  /** false — ключ уже існує → виконання пропускається (ідемпотентність) */
  tryStart(key: string, meta: { tenantId: string; workflowOn: string }): Promise<boolean>;
  finish(key: string, status: 'ok' | 'error' | 'skipped', error?: string): Promise<void>;
  list(tenantId: string, limit: number): Promise<WorkflowRunRow[]>;
}

export interface PendingOutboxEvent {
  id: string;
  tenantId: string;
  appSlug: string;
  eventType: string;
  payload: Record<string, Json>;
}

export interface OutboxDrainPort {
  pending(limit: number): Promise<PendingOutboxEvent[]>;
  markProcessed(
    id: string,
    status: 'done' | 'skipped' | 'error',
    error?: string,
  ): Promise<void>;
}

/* --------------------------------- memory ------------------------------ */

export class MemoryWorkflowRunsPort implements WorkflowRunsPort {
  readonly rows: WorkflowRunRow[] = [];

  async tryStart(
    key: string,
    meta: { tenantId: string; workflowOn: string },
  ): Promise<boolean> {
    if (this.rows.some((r) => r.idempotencyKey === key)) return false;
    this.rows.push({
      idempotencyKey: key,
      tenantId: meta.tenantId,
      workflowOn: meta.workflowOn,
      status: 'running',
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  async finish(key: string, status: 'ok' | 'error' | 'skipped', error?: string): Promise<void> {
    const row = this.rows.find((r) => r.idempotencyKey === key);
    if (row) {
      row.status = status;
      row.error = error ?? null;
      row.finishedAt = new Date().toISOString();
    }
  }

  async list(tenantId: string, limit: number): Promise<WorkflowRunRow[]> {
    return structuredClone(
      this.rows.filter((r) => r.tenantId === tenantId).slice(-limit).reverse(),
    );
  }
}

export interface SharedOutboxRow extends OutboxEvent {
  processedAt?: string | null;
  processStatus?: 'done' | 'skipped' | 'error';
  processError?: string | null;
}

export class MemoryOutboxDrainPort implements OutboxDrainPort {
  readonly events: Array<SharedOutboxRow>;

  constructor(shared?: Array<SharedOutboxRow>) {
    this.events = shared ?? [];
  }

  push(
    e: {
      id: string;
      tenantId: string;
      appSlug: string;
      eventType: string;
      payload: Record<string, Json>;
    },
  ): void {
    this.events.push({
      id: e.id,
      tenantId: e.tenantId,
      appSlug: e.appSlug,
      eventType: e.eventType,
      payload: { ...e.payload },
      createdAt: new Date().toISOString(),
    });
  }

  async pending(limit: number): Promise<PendingOutboxEvent[]> {
    return this.events
      .filter((e) => !e.processedAt)
      .slice(0, limit)
      .map((e) => ({
        id: e.id,
        tenantId: e.tenantId,
        appSlug: e.appSlug,
        eventType: e.eventType,
        payload: { ...e.payload } as Record<string, Json>,
      }));
  }

  async markProcessed(id: string, status: 'done' | 'skipped' | 'error', error?: string): Promise<void> {
    const row = this.events.find((e) => e.id === id);
    if (row) {
      row.processedAt = new Date().toISOString();
      row.processStatus = status;
      row.processError = error ?? null;
    }
  }
}

/* ----------------------------------- D1 -------------------------------- */

function parsePayload(raw: string): Record<string, Json> {
  try {
    const v = JSON.parse(raw) as unknown;
    return typeof v === 'object' && v !== null
      ? (v as Record<string, Json>)
      : {};
  } catch {
    return {};
  }
}

export class D1OutboxDrainPort implements OutboxDrainPort {
  constructor(private readonly db: D1Executor) {}

  async pending(limit: number): Promise<PendingOutboxEvent[]> {
    const { results } = await this.db
      .prepare(
        `SELECT id, tenant_id, app_slug, event_type, payload FROM outbox_events
         WHERE processed_at IS NULL ORDER BY created_at LIMIT ?1`,
      )
      .bind(limit)
      .all<Record<string, unknown>>();
    return (results ?? []).map((r) => ({
      id: String(r.id),
      tenantId: String(r.tenant_id),
      appSlug: String(r.app_slug),
      eventType: String(r.event_type),
      payload: parsePayload(String(r.payload)),
    }));
  }

  async markProcessed(
    id: string,
    status: 'done' | 'skipped' | 'error',
    error?: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE outbox_events SET processed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
         process_status = ?2, process_error = ?3 WHERE id = ?1`,
      )
      .bind(id, status, error ?? null)
      .run();
  }
}

export class D1WorkflowRunsPort implements WorkflowRunsPort {
  constructor(private readonly db: D1Executor) {}

  async tryStart(
    key: string,
    meta: { tenantId: string; workflowOn: string },
  ): Promise<boolean> {
    try {
      await this.db
        .prepare(
          `INSERT INTO workflow_runs (id, tenant_id, idempotency_key, workflow_on, status)
           VALUES (?1, ?2, ?3, ?4, 'running')`,
        )
        .bind(crypto.randomUUID(), meta.tenantId, key, meta.workflowOn)
        .run();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/UNIQUE/i.test(msg)) return false;
      throw e;
    }
  }

  async finish(key: string, status: 'ok' | 'error' | 'skipped', error?: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE workflow_runs SET status = ?2, error = ?3, finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE idempotency_key = ?1 AND status = 'running'`,
      )
      .bind(key, status, error ?? null)
      .run();
  }

  async list(tenantId: string, limit: number): Promise<WorkflowRunRow[]> {
    const { results } = await this.db
      .prepare(
        `SELECT idempotency_key, tenant_id, workflow_on, status, error, created_at, finished_at
         FROM workflow_runs WHERE tenant_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
      )
      .bind(tenantId, Math.min(Math.max(limit, 1), 200))
      .all<Record<string, unknown>>();
    return (results ?? []).map((r) => ({
      idempotencyKey: String(r.idempotency_key),
      tenantId: String(r.tenant_id),
      workflowOn: String(r.workflow_on),
      status: r.status as WorkflowRunRow['status'],
      error: r.error == null ? null : String(r.error),
      createdAt: String(r.created_at),
      finishedAt: r.finished_at == null ? null : String(r.finished_at),
    }));
  }

}

