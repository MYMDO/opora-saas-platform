import { Hono } from 'hono';
import type { AppEnv } from '../index';
import {
  employeeCreateSchema,
  employeePatchSchema,
  enterprisePutSchema,
  parseBody,
  readJson,
} from '../lib/validate';

interface EmployeeRow {
  id: string;
  name: string;
  monthlySalaryUah: number;
}

function mapRow(r: Record<string, unknown>): EmployeeRow {
  return {
    id: String(r.id),
    name: String(r.name),
    monthlySalaryUah: Number(r.monthly_salary_uah),
  };
}

const SELECT_COLS = 'id, name, monthly_salary_uah';

export function hrRoutes() {
  const r = new Hono<AppEnv>();

  r.get('/employees', async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT ${SELECT_COLS} FROM employees WHERE tenant_id = ? ORDER BY created_at, id`,
    )
      .bind(c.get('tenant'))
      .all();
    return c.json({ employees: (results ?? []).map(mapRow) });
  });

  r.post('/employees', async (c) => {
    const parsed = parseBody(employeeCreateSchema, await readJson(c));
    if (!parsed.ok) return c.json({ error: 'Некоректні дані', issues: parsed.issues }, 400);
    const v = parsed.value;
    const id = v.id ?? crypto.randomUUID();

    const existing = await c.env.DB.prepare('SELECT tenant_id FROM employees WHERE id = ?')
      .bind(id)
      .first<{ tenant_id: string }>();
    if (existing) return c.json({ error: 'Працівника з таким id вже існує' }, 409);

    const row = await c.env.DB.prepare(
      `INSERT INTO employees (id, tenant_id, name, monthly_salary_uah)
       VALUES (?1, ?2, ?3, ?4)
       RETURNING ${SELECT_COLS}`,
    )
      .bind(id, c.get('tenant'), v.name, v.monthlySalaryUah)
      .first<Record<string, unknown>>();
    return c.json({ employee: row && mapRow(row) }, 201);
  });

  r.patch('/employees/:id', async (c) => {
    const parsed = parseBody(employeePatchSchema, await readJson(c));
    if (!parsed.ok) return c.json({ error: 'Некоректні дані', issues: parsed.issues }, 400);
    const v = parsed.value;

    const sets: string[] = [];
    const params: Array<string | number> = [];
    if (v.name !== undefined) {
      sets.push('name = ?');
      params.push(v.name);
    }
    if (v.monthlySalaryUah !== undefined) {
      sets.push('monthly_salary_uah = ?');
      params.push(v.monthlySalaryUah);
    }
    params.push(c.get('tenant'), c.req.param('id'));

    const row = await c.env.DB.prepare(
      `UPDATE employees SET ${sets.join(', ')}
       WHERE tenant_id = ? AND id = ?
       RETURNING ${SELECT_COLS}`,
    )
      .bind(...params)
      .first<Record<string, unknown>>();
    if (!row) return c.json({ error: 'Працівника не знайдено' }, 404);
    return c.json({ employee: mapRow(row) });
  });

  r.delete('/employees/:id', async (c) => {
    const row = await c.env.DB.prepare(
      'DELETE FROM employees WHERE tenant_id = ? AND id = ? RETURNING id',
    )
      .bind(c.get('tenant'), c.req.param('id'))
      .first();
    if (!row) return c.json({ error: 'Працівника не знайдено' }, 404);
    return c.json({ ok: true });
  });

  r.get('/enterprise', async (c) => {
    const row = await c.env.DB.prepare(
      `SELECT territory_type, has_critical_status, is_critical_industry,
              has_tax_debt, obligated_count, booked_count
       FROM enterprise_booking WHERE tenant_id = ?`,
    )
      .bind(c.get('tenant'))
      .first<Record<string, unknown>>();
    if (!row) return c.json({ error: 'Контекст підприємства не ініціалізовано' }, 404);
    return c.json({
      enterprise: {
        territoryType: String(row.territory_type),
        hasCriticalEnterpriseStatus: Number(row.has_critical_status) === 1,
        isCriticalIndustry: Number(row.is_critical_industry) === 1,
        hasTaxDebt: Number(row.has_tax_debt) === 1,
        militaryObligatedCount: Number(row.obligated_count),
        alreadyBookedCount: Number(row.booked_count),
      },
    });
  });

  r.put('/enterprise', async (c) => {
    const parsed = parseBody(enterprisePutSchema, await readJson(c));
    if (!parsed.ok) return c.json({ error: 'Некоректні дані', issues: parsed.issues }, 400);
    const v = parsed.value;
    await c.env.DB.prepare(
      `INSERT INTO enterprise_booking
         (tenant_id, territory_type, has_critical_status, is_critical_industry, has_tax_debt, obligated_count, booked_count)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(tenant_id) DO UPDATE SET
         territory_type = excluded.territory_type,
         has_critical_status = excluded.has_critical_status,
         is_critical_industry = excluded.is_critical_industry,
         has_tax_debt = excluded.has_tax_debt,
         obligated_count = excluded.obligated_count,
         booked_count = excluded.booked_count`,
    )
      .bind(
        c.get('tenant'),
        v.territoryType,
        v.hasCriticalStatus ? 1 : 0,
        v.isCriticalIndustry ? 1 : 0,
        v.hasTaxDebt ? 1 : 0,
        v.obligatedCount,
        v.bookedCount,
      )
      .run();
    return c.json({ ok: true });
  });

  return r;
}
