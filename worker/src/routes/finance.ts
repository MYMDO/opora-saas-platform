import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { contractorCreateSchema, contractorPatchSchema, parseBody, readJson } from '../lib/validate';

interface ContractorRow {
  id: string;
  name: string;
  usedUah: number;
  limitUah: number;
}

function mapRow(r: Record<string, unknown>): ContractorRow {
  return {
    id: String(r.id),
    name: String(r.name),
    usedUah: Number(r.used_uah),
    limitUah: Number(r.limit_uah),
  };
}

const SELECT_COLS = 'id, name, used_uah, limit_uah';

export function financeRoutes() {
  const r = new Hono<AppEnv>();

  r.get('/contractors', async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT ${SELECT_COLS} FROM contractors WHERE tenant_id = ? ORDER BY created_at, id`,
    )
      .bind(c.get('tenant'))
      .all();
    return c.json({ contractors: (results ?? []).map(mapRow) });
  });

  r.post('/contractors', async (c) => {
    const parsed = parseBody(contractorCreateSchema, await readJson(c));
    if (!parsed.ok) return c.json({ error: 'Некоректні дані', issues: parsed.issues }, 400);
    const v = parsed.value;
    const id = v.id ?? crypto.randomUUID();

    const existing = await c.env.DB.prepare('SELECT tenant_id FROM contractors WHERE id = ?')
      .bind(id)
      .first<{ tenant_id: string }>();
    if (existing) return c.json({ error: 'Контрагента з таким id вже існує' }, 409);

    const row = await c.env.DB.prepare(
      `INSERT INTO contractors (id, tenant_id, name, used_uah, limit_uah)
       VALUES (?1, ?2, ?3, ?4, ?5)
       RETURNING ${SELECT_COLS}`,
    )
      .bind(id, c.get('tenant'), v.name, v.usedUah ?? 0, v.limitUah)
      .first<Record<string, unknown>>();
    return c.json({ contractor: row && mapRow(row) }, 201);
  });

  r.patch('/contractors/:id', async (c) => {
    const parsed = parseBody(contractorPatchSchema, await readJson(c));
    if (!parsed.ok) return c.json({ error: 'Некоректні дані', issues: parsed.issues }, 400);
    const v = parsed.value;

    const sets: string[] = [];
    const params: Array<string | number> = [];
    if (v.name !== undefined) {
      sets.push('name = ?');
      params.push(v.name);
    }
    if (v.usedUah !== undefined) {
      sets.push('used_uah = ?');
      params.push(v.usedUah);
    }
    if (v.limitUah !== undefined) {
      sets.push('limit_uah = ?');
      params.push(v.limitUah);
    }
    params.push(c.get('tenant'), c.req.param('id'));

    const row = await c.env.DB.prepare(
      `UPDATE contractors SET ${sets.join(', ')}
       WHERE tenant_id = ? AND id = ?
       RETURNING ${SELECT_COLS}`,
    )
      .bind(...params)
      .first<Record<string, unknown>>();
    if (!row) return c.json({ error: 'Контрагента не знайдено' }, 404);
    return c.json({ contractor: mapRow(row) });
  });

  r.delete('/contractors/:id', async (c) => {
    const row = await c.env.DB.prepare(
      'DELETE FROM contractors WHERE tenant_id = ? AND id = ? RETURNING id',
    )
      .bind(c.get('tenant'), c.req.param('id'))
      .first();
    if (!row) return c.json({ error: 'Контрагента не знайдено' }, 404);
    return c.json({ ok: true });
  });

  return r;
}
