
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
    sql: 'INSERT INTO outbox_events (id, tenant_id, app_slug, event_type, payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
    params: [o.id, o.tenantId, o.appSlug, o.eventType, JSON.stringify(o.payload), o.createdAt],
  };
}

/** Екранування LIKE-патерна: шукаємо буквальний підрядок, не шаблон.
 * Увага: SQLite LIKE згортає регістр лише для ASCII (в D1 нема ICU),
 * тому кириличний пошук чутливий до регістру; memory-адаптер — ні. */
export function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function buildWhere(
  ctx: DataPortContext,
  entity: string,
  filters: Record<string, Json> | undefined,
  search?: { fields: string[]; query: string },
): { where: string[]; params: unknown[] } {
  const where = ['tenant_id = ?1', 'app_slug = ?2', 'entity = ?3', 'deleted_at IS NULL'];
  const params: unknown[] = [ctx.tenantId, ctx.appSlug, entity];
  let n = params.length;
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (!FIELD_KEY_RE.test(key)) continue;
    n += 1;
    if (key === 'owner_id') where.push(`owner_id = ?${n}`);
    else where.push(`json_extract(data, '$.${key}') = ?${n}`);
    params.push(value);
  }
  const q = search?.query.trim() ?? '';
  const fields = (search?.fields ?? []).filter((f) => FIELD_KEY_RE.test(f));
  if (q && fields.length > 0) {
    n += 1;
    where.push(`(${fields.map((f) => `json_extract(data, '$.${f}') LIKE ?${n} ESCAPE '\\'`).join(' OR ')})`);
    params.push(`%${escapeLike(q)}%`);
  }
  return { where, params };
}

export function buildAggregateQuery(
  ctx: DataPortContext,
  entity: string,
  groupBy: string,
  filters: Record<string, Json> | undefined,
): SqlStatement {
  if (!FIELD_KEY_RE.test(groupBy)) throw new Error(`некоректне поле групування: ${groupBy}`);
  const { where, params } = buildWhere(ctx, entity, filters);
  const expr = `json_extract(data, '$.${groupBy}')`;
  return {
    sql: `SELECT ${expr} AS v, COUNT(*) AS c FROM records WHERE ${where.join(' AND ')} GROUP BY ${expr} ORDER BY c DESC LIMIT 500`,
    params,
  };
}

export function buildListQuery(
  ctx: DataPortContext,
  entity: string,
  q: QuerySpec | undefined,
): SqlStatement {
  const { where, params } = buildWhere(ctx, entity, q?.filters, q?.search);
  const n = params.length;
  const limit = Math.min(Math.max(q?.limit ?? 100, 1), 500);
  const offset = Math.max(q?.offset ?? 0, 0);
  const sortField = FIELD_KEY_RE.test(q?.sortBy ?? '') ? `$.${q?.sortBy}` : null;
  const order = sortField
    ? `ORDER BY json_extract(data, '${sortField}') ${q?.sortDir === 'desc' ? 'DESC' : 'ASC'}`
    : 'ORDER BY updated_at DESC';
  params.push(limit, offset);
  return {
    sql: `SELECT ${RECORD_COLS} FROM records WHERE ${where.join(' AND ')} ${order} LIMIT ?${n + 1} OFFSET ?${n + 2}`,
    params: [...params],
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

  async aggregate(
    ctx: DataPortContext,
    entity: EntityDefinition,
    opts: { groupBy: string; filters?: Record<string, Json> },
  ): Promise<Array<{ value: string | number | boolean | null; count: number }>> {
    const { results } = await this.prep(
      buildAggregateQuery(ctx, entity.apiName, opts.groupBy, opts.filters),
    ).all<{ v: unknown; c: number }>();
    return (results ?? []).map((r) => ({
      value:
        r.v === null || r.v === undefined || typeof r.v === 'object'
          ? null
          : (r.v as string | number | boolean),
      count: Number(r.c),
    }));
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
      appSlug: ctx.appSlug,
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

  async audit(
    ctx: DataPortContext,
    opts?: { limit?: number; action?: string },
  ): Promise<AuditEvent[]> {
    const conds = ['tenant_id = ?1'];
    const params: unknown[] = [ctx.tenantId];
    if (opts?.action) {
      params.push(opts.action);
      conds.push(`action = ?${params.length}`);
    }
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    params.push(limit);
    const { results } = await this.db
      .prepare(
        `SELECT id, tenant_id, actor_id, action, resource_type, resource_id, before, after, occurred_at
         FROM audit_events WHERE ${conds.join(' AND ')} ORDER BY occurred_at DESC LIMIT ?${params.length}`,
      )
      .bind(...params)
      .all<Record<string, unknown>>();
    return (results ?? []).map((r) => ({
      id: String(r.id),
      tenantId: String(r.tenant_id),
      actorId: r.actor_id == null ? null : String(r.actor_id),
      action: String(r.action) as 'create' | 'update' | 'delete',
      resourceType: String(r.resource_type),
      resourceId: String(r.resource_id),
      before: r.before == null ? null : (JSON.parse(String(r.before)) as Record<string, Json>),
      after: r.after == null ? null : (JSON.parse(String(r.after)) as Record<string, Json>),
      occurredAt: String(r.occurred_at),
    }));
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
      appSlug: ctx.appSlug,
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
