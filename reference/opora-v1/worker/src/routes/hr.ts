import { Hono } from 'hono';
import { crudRoutes } from '../lib/crud';
import type { AppEnv } from '../index';
import {
  employeeCreateSchema,
  employeePatchSchema,
  enterprisePutSchema,
  parseBody,
  readJson,
} from '../lib/validate';

const employeeRoutes = () =>
  crudRoutes({
    table: 'employees',
    columns: 'id, name, monthly_salary_uah, is_military_obliged',
    mapRow: (r) => ({
      id: String(r.id),
      name: String(r.name),
      monthlySalaryUah: Number(r.monthly_salary_uah),
      isMilitaryObliged: Number(r.is_military_obliged) === 1,
    }),
    createSchema: employeeCreateSchema,
    patchSchema: employeePatchSchema,
    patchColumns: {
      name: 'name',
      monthlySalaryUah: 'monthly_salary_uah',
      isMilitaryObliged: 'is_military_obliged',
    },
    createColumns: (v) => [
      { column: 'monthly_salary_uah', value: v.monthlySalaryUah },
      { column: 'is_military_obliged', value: v.isMilitaryObliged ? 1 : 0 },
    ],
    notFoundLabel: 'Працівника не знайдено',
  });

export function hrRoutes() {
  const r = new Hono<AppEnv>();
  r.route('/', employeeRoutes());

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
