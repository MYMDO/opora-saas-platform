
import type { EntityDefinition } from '@opora/dsl';
import { RecordNotFoundError } from './errors';
import type { AuditEvent, DataPort, DataPortContext, OutboxEvent } from './port';
import type { Json, Page, QuerySpec, RecordEntity } from './validate';
import { validateRecord } from './validate';

export interface MemoryDataPortState {
  records: RecordEntity[];
  audit: AuditEvent[];
  outbox: OutboxEvent[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function applyFilters(rows: RecordEntity[], q: QuerySpec | undefined): RecordEntity[] {
  const filters = q?.filters ?? {};
  return rows.filter((r) =>
    Object.entries(filters).every(([k, v]) => r.data[k] === v),
  );
}

/** Повна реалізація в памʼяті: тести, локальна розробка, офлайн-режим. */
export class MemoryDataPort implements DataPort {
  readonly state: MemoryDataPortState;

  constructor(state?: Partial<MemoryDataPortState>) {
    this.state = {
      records: state?.records ?? [],
      audit: state?.audit ?? [],
      outbox: state?.outbox ?? [],
    };
  }

  private live(
    ctx: DataPortContext,
    entity: EntityDefinition,
    id: string,
  ): RecordEntity {
    const row = this.state.records.find(
      (r) =>
        !r.deletedAt &&
        r.id === id &&
        r.tenantId === ctx.tenantId &&
        r.entity === entity.apiName,
    );
    if (!row) throw new RecordNotFoundError(entity.apiName, id);
    return row;
  }

  async list(
    ctx: DataPortContext,
    entity: EntityDefinition,
    q?: QuerySpec,
  ): Promise<Page> {
    const rows = applyFilters(
      this.state.records.filter(
        (r) =>
          !r.deletedAt &&
          r.tenantId === ctx.tenantId &&
          r.appSlug === ctx.appSlug &&
          r.entity === entity.apiName,
      ),
      q,
    ).slice(0, q?.limit ?? 100);
    return { rows: structuredClone(rows) };
  }

  async get(ctx: DataPortContext, entity: EntityDefinition, id: string): Promise<RecordEntity | null> {
    const row = this.state.records.find(
      (r) =>
        !r.deletedAt &&
        r.id === id &&
        r.tenantId === ctx.tenantId &&
        r.entity === entity.apiName,
    );
    return row ? structuredClone(row) : null;
  }

  async create(
    ctx: DataPortContext,
    entity: EntityDefinition,
    data: unknown,
  ): Promise<RecordEntity> {
    const clean = validateRecord(entity, data, 'create');
    const ts = nowIso();
    const record: RecordEntity = {
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      appSlug: ctx.appSlug,
      entity: entity.apiName,
      data: clean,
      ownerId: ctx.actorId,
      createdAt: ts,
      updatedAt: ts,
    };
    this.state.records.push(record);
    this.emit(ctx, 'create', entity.apiName, record, null);
    return structuredClone(record);
  }

  async update(
    ctx: DataPortContext,
    entity: EntityDefinition,
    id: string,
    patch: unknown,
  ): Promise<RecordEntity> {
    const before = structuredClone(await this.get(ctx, entity, id));
    const existing = this.live(ctx, entity, id);
    const clean = validateRecord(entity, patch, 'patch');
    existing.data = { ...existing.data, ...clean };
    existing.updatedAt = nowIso();
    this.emit(ctx, 'update', entity.apiName, existing, before?.data ?? null);
    return structuredClone(existing);
  }

  async audit(
    ctx: DataPortContext,
    opts?: { limit?: number; action?: string },
  ): Promise<AuditEvent[]> {
    let rows = this.state.audit.filter((a) => a.tenantId === ctx.tenantId);
    if (opts?.action) rows = rows.filter((a) => a.action === opts.action);
    return structuredClone(rows.slice(-(opts?.limit ?? 50)).reverse());
  }

  async softDelete(ctx: DataPortContext, entity: EntityDefinition, id: string): Promise<void> {
    const before = structuredClone(await this.get(ctx, entity, id));
    const existing = this.live(ctx, entity, id);
    existing.deletedAt = nowIso();
    this.emit(ctx, 'delete', entity.apiName, existing, before?.data ?? null);
  }

  private emit(
    ctx: DataPortContext,
    action: AuditEvent['action'],
    resourceType: string,
    record: RecordEntity,
    before: Record<string, Json> | null,
  ): void {
    const ts = nowIso();
    this.state.audit.push({
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action,
      resourceType,
      resourceId: record.id,
      before: action === 'create' ? null : (before ?? null),
      after: action === 'delete' ? null : record.data,
      occurredAt: ts,
    });
    if (action !== 'update') {
      this.state.outbox.push({
        id: crypto.randomUUID(),
        tenantId: ctx.tenantId,
        appSlug: ctx.appSlug,
        eventType: `${resourceType}.${action}d`,
        payload: { recordId: record.id },
        createdAt: ts,
      });
    }
  }
}
