import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { readJson } from '../lib/validate';

interface ZodIssue {
  path: Array<string | number | symbol>;
  message: string;
}

interface ParseOk<T> {
  success: true;
  data: T;
}

interface ParseFail {
  success: false;
  error: { issues: ZodIssue[] };
}

type ZodLike<T> = {
  safeParse(v: unknown): ParseOk<T> | ParseFail;
};

export interface CrudConfig<TCreate, TPatch> {
  /** Назва таблиці = назва колекції у відповіді (множина) */
  table: string;
  /** SELECT-список колонок без ключового слова SELECT */
  columns: string;
  mapRow(r: Record<string, unknown>): unknown;
  createSchema: ZodLike<TCreate>;
  patchSchema: ZodLike<TPatch>;
  /** Патч-ключ → SQL-колонка; ключі з undefined пропускаються */
  patchColumns: Partial<Record<keyof TPatch, string>>;
  /** Додаткові колонки INSERT (крім id/tenant_id/name), у порядку вставки */
  createColumns?(v: TCreate): Array<{ column: string; value: string | number }>;
  notFoundLabel?: string;
}

type ZixIssue = ZodIssue;

function fail(c: { json(body: unknown, status?: number): Response }, issues: ZixIssue[]) {
  return c.json(
    { error: 'Некоректні дані', issues: issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`) },
    400,
  );
}

export function crudRoutes<TCreate, TPatch>(cfg: CrudConfig<TCreate, TPatch>) {
  const r = new Hono<AppEnv>();
  const single = cfg.table.slice(0, -1);
  const notFound = cfg.notFoundLabel ?? 'Запис не знайдено';

  r.get(`/${cfg.table}`, async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT ${cfg.columns} FROM ${cfg.table} WHERE tenant_id = ? ORDER BY created_at, id`,
    )
      .bind(c.get('tenant'))
      .all();
    return c.json({ [cfg.table]: (results ?? []).map(cfg.mapRow) });
  });

  r.post(`/${cfg.table}`, async (c) => {
    const parsed = cfg.createSchema.safeParse(await readJson(c));
    if (!parsed.success) return fail(c, parsed.error.issues);
    const v = parsed.data;
    const id = (v as { id?: string }).id ?? crypto.randomUUID();

    const existing = await c.env.DB.prepare(`SELECT tenant_id FROM ${cfg.table} WHERE id = ?`)
      .bind(id)
      .first<{ tenant_id: string }>();
    if (existing) return c.json({ error: 'Запис з таким id вже існує' }, 409);

    const extra = cfg.createColumns ? cfg.createColumns(v) : [];
    const cols = ['id', 'tenant_id', 'name', ...extra.map((e) => e.column)];
    const vals: Array<string | number> = [
      id,
      c.get('tenant'),
      (v as { name: string }).name,
      ...extra.map((e) => e.value),
    ];
    const placeholders = cols.map((_, i) => `?${i + 1}`).join(', ');

    const row = await c.env.DB.prepare(
      `INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING ${cfg.columns}`,
    )
      .bind(...vals)
      .first<Record<string, unknown>>();
    return c.json({ [single]: row && cfg.mapRow(row) }, 201);
  });

  r.patch(`/${cfg.table}/:id`, async (c) => {
    const parsed = cfg.patchSchema.safeParse(await readJson(c));
    if (!parsed.success) return fail(c, parsed.error.issues);
    const v = parsed.data as Record<string, unknown>;

    const sets: string[] = [];
    const params: Array<string | number> = [];
    for (const [key, column] of Object.entries(cfg.patchColumns) as Array<[keyof TPatch, string]>) {
      const value = v[key as string];
      if (value === undefined) continue;
      sets.push(`${column} = ?`);
      params.push(value as string | number);
    }
    params.push(c.get('tenant'), c.req.param('id'));

    const row = await c.env.DB.prepare(
      `UPDATE ${cfg.table} SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ? RETURNING ${cfg.columns}`,
    )
      .bind(...params)
      .first<Record<string, unknown>>();
    if (!row) return c.json({ error: notFound }, 404);
    return c.json({ [single]: cfg.mapRow(row) });
  });

  r.delete(`/${cfg.table}/:id`, async (c) => {
    const row = await c.env.DB.prepare(
      `DELETE FROM ${cfg.table} WHERE tenant_id = ? AND id = ? RETURNING id`,
    )
      .bind(c.get('tenant'), c.req.param('id'))
      .first();
    if (!row) return c.json({ error: notFound }, 404);
    return c.json({ ok: true });
  });

  return r;
}
