
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
    Object.entries(filters).every(([k, v]) => (k === 'owner_id' ? r.ownerId === v : r.data[k] === v)),
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

  private scoped(ctx: DataPortContext, entity: EntityDefinition): RecordEntity[] {
    return this.state.records.filter(
      (r) =>
        !r.deletedAt &&
        r.tenantId === ctx.tenantId &&
        r.appSlug === ctx.appSlug &&
        r.entity === entity.apiName,
    );
  }

  async list(
    ctx: DataPortContext,
    entity: EntityDefinition,
    q?: QuerySpec,
  ): Promise<Page> {
    let rows = applyFilters(this.scoped(ctx, entity), q);
    if (q?.sortBy) {
      const dir = q.sortDir === 'desc' ? -1 : 1;
      rows.sort((a, b) => {
        const av = a.data[q.sortBy!] ?? '';
        const bv = b.data[q.sortBy!] ?? '';
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }
    const offset = q?.offset ?? 0;
    const limit = q?.limit ?? 100;
    rows = rows.slice(offset, offset + limit);
    return { rows: structuredClone(rows) };
  }

  async aggregate(
    ctx: DataPortContext,
    entity: EntityDefinition,
    opts: { groupBy: string; filters?: Record<string, Json> },
  ): Promise<Array<{ value: string | number | boolean | null; count: number }>> {
    const rows = applyFilters(this.scoped(ctx, entity), { filters: opts.filters });
    const counts = new Map<string, { value: string | number | boolean | null; count: number }>();
    for (const r of rows) {
      const raw = r.data[opts.groupBy];
      const value =
        raw === undefined || raw === null || typeof raw === 'object'
          ? null
          : (raw as string | number | boolean);
      const key = `${typeof value}:${String(value)}`;
      const slot = counts.get(key) ?? { value, count: 0 };
      slot.count += 1;
      counts.set(key, slot);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
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
