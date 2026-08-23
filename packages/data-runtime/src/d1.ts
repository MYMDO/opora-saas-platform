
import type { EntityDefinition } from '@opora/dsl';
import { RecordNotFoundError } from './errors';
import type { AuditEvent, DataPort, DataPortContext, OutboxEvent } from './port';
import { validateRecord } from './validate';
import type { Json, Page, QuerySpec, RecordEntity } from './validate';

/* Структурний інтерфейс D1 — без залежності від workers-types */

export interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  all<T>(): Promise<{ results?: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Executor {
  prepare(sql: string): D1Prepared;
  batch(statements: D1Prepared[]): Promise<Array<{ success: boolean }>>;
}

const FIELD_KEY_RE = /^[a-z][a-z0-9_]*$/;

interface RecordRow {
  id: string;
  data: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowToRecord(row: RecordRow, ctx: DataPortContext, entity: string): RecordEntity {
  return {
    id: row.id,
    tenantId: ctx.tenantId,
    appSlug: ctx.appSlug,
    entity,
    data: JSON.parse(row.data) as Record<string, Json>,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface SqlStatement {
  sql: string;
  params: unknown[];
}

const RECORD_COLS = 'id, data, owner_id, created_at, updated_at';

/* --------------------------- білдери SQL --------------------------- */

export function buildInsertRecord(r: RecordEntity): SqlStatement {
  return {
    sql: 'INSERT INTO records (id, tenant_id, app_slug, entity, data, owner_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
    params: [r.id, r.tenantId, r.appSlug, r.entity, JSON.stringify(r.data), r.ownerId, r.createdAt, r.updatedAt],
  };
}

export function buildUpdateRecord(id: string, data: Record<string, Json>): SqlStatement {
  return {
    sql: 'UPDATE records SET data = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL',
    params: [JSON.stringify(data), nowIso(), id],
  };
}

export function buildSoftDelete(id: string): SqlStatement {
  return {
    sql: 'UPDATE records SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL',
    params: [nowIso(), id],
  };
}

export function buildAudit(a: AuditEvent): SqlStatement {
  return {
    sql: 'INSERT INTO audit_events (id, tenant_id, actor_id, action, resource_type, resource_id, before, after, occurred_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
    params: [
      a.id,
      a.tenantId,
      a.actorId,
      a.action,
      a.resourceType,
      a.resourceId,
      a.before === null ? null : JSON.stringify(a.before),
      a.after === null ? null : JSON.stringify(a.after),
      a.occurredAt,
    ],
  };
}

export function buildOutbox(o: OutboxEvent): SqlStatement {
  return {
    sql: 'INSERT INTO outbox_events (id, tenant_id, event_type, payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
    params: [o.id, o.tenantId, o.eventType, JSON.stringify(o.payload), o.createdAt],
  };
}

export function buildListQuery(
  ctx: DataPortContext,
  entity: string,
  q: QuerySpec | undefined,
): SqlStatement {
  const where = ['tenant_id = ?1', 'app_slug = ?2', 'entity = ?3', 'deleted_at IS NULL'];
  const params: unknown[] = [ctx.tenantId, ctx.appSlug, entity];
  let n = params.length;
  for (const [key, value] of Object.entries(q?.filters ?? {})) {
    if (!FIELD_KEY_RE.test(key)) continue;
    n += 1;
    where.push(`json_extract(data, '$.${key}') = ?${n}`);
    params.push(value);
  }
  const limit = Math.min(Math.max(q?.limit ?? 100, 1), 100);
  return {
    sql: `SELECT ${RECORD_COLS} FROM records WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT ${limit}`,
    params,
  };
}

/* ------------------------------ адаптер ---------------------------- */

export class D1DataPort implements DataPort {
  constructor(private readonly db: D1Executor) {}

  private prep(stmt: SqlStatement): D1Prepared {
    return this.db.prepare(stmt.sql).bind(...stmt.params);
  }

  async list(ctx: DataPortContext, entity: EntityDefinition, q?: QuerySpec): Promise<Page> {
    const { results } = await this.prep(buildListQuery(ctx, entity.apiName, q)).all<RecordRow>();
    return { rows: (results ?? []).map((row) => rowToRecord(row, ctx, entity.apiName)) };
  }

  async get(ctx: DataPortContext, entity: EntityDefinition, id: string): Promise<RecordEntity | null> {
    const { results } = await this.db
      .prepare(`SELECT ${RECORD_COLS} FROM records WHERE id = ?1 AND tenant_id = ?2 AND entity = ?3 AND deleted_at IS NULL`)
      .bind(id, ctx.tenantId, entity.apiName)
      .all<RecordRow>();
    const row = results?.[0];
    return row ? rowToRecord(row, ctx, entity.apiName) : null;
  }

  private async mustGet(
    ctx: DataPortContext,
    entity: EntityDefinition,
    id: string,
  ): Promise<{ stored: RecordEntity; raw: RecordRow }> {
    const { results } = await this.db
      .prepare(`SELECT ${RECORD_COLS} FROM records WHERE id = ?1 AND tenant_id = ?2 AND entity = ?3 AND deleted_at IS NULL`)
      .bind(id, ctx.tenantId, entity.apiName)
      .all<RecordRow>();
    const row = results?.[0];
    if (!row) throw new RecordNotFoundError(entity.apiName, id);
    return { stored: rowToRecord(row, ctx, entity.apiName), raw: row };
  }

  async create(ctx: DataPortContext, entity: EntityDefinition, data: unknown): Promise<RecordEntity> {
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

    const audit: AuditEvent = {
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: 'create',
      resourceType: entity.apiName,
      resourceId: record.id,
      before: null,
      after: clean,
      occurredAt: ts,
    };
    const outbox: OutboxEvent = {
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      eventType: `${entity.apiName}.created`,
      payload: { recordId: record.id },
      createdAt: ts,
    };

    await this.db.batch([
      this.prep(buildInsertRecord(record)),
      this.prep(buildAudit(audit)),
      this.prep(buildOutbox(outbox)),
    ]);

    return structuredClone(record);
  }

  async update(
    ctx: DataPortContext,
    entity: EntityDefinition,
    id: string,
    patch: unknown,
  ): Promise<RecordEntity> {
    const { stored } = await this.mustGet(ctx, entity, id);
    const clean = validateRecord(entity, patch, 'patch');
    const merged = { ...stored.data, ...clean };
    const ts = nowIso();

    const updateStmt = buildUpdateRecord(id, merged);
    const audit = buildAudit({
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: 'update',
      resourceType: entity.apiName,
      resourceId: id,
      before: stored.data,
      after: merged,
      occurredAt: ts,
    });

    await this.db.batch([this.prep(updateStmt), this.prep(audit)]);

    return { ...stored, data: merged, updatedAt: ts };
  }

  async softDelete(ctx: DataPortContext, entity: EntityDefinition, id: string): Promise<void> {
    const { stored } = await this.mustGet(ctx, entity, id);
    const ts = nowIso();

    const del = buildSoftDelete(id);
    const audit = buildAudit({
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: 'delete',
      resourceType: entity.apiName,
      resourceId: id,
      before: stored.data,
      after: null,
      occurredAt: ts,
    });
    const outbox: OutboxEvent = {
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      eventType: `${entity.apiName}.deleted`,
      payload: { recordId: id },
      createdAt: ts,
    };

    await this.db.batch([
      this.prep(del),
      this.prep(audit),
      this.prep(buildOutbox(outbox)),
    ]);
  }
}
