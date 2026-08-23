import type { ContractorRow } from '../modules/finance/index';
import type { EmployeeRow, EnterpriseBookingContext } from '../modules/hr/index';

/** Порожньо = same-origin (Pages Functions /v1/*). Перевизначається через VITE_API_BASE. */
export const API_BASE_URL: string =
  ((import.meta.env?.VITE_API_BASE as string | undefined) ?? '').trim();

const TENANT = 'demo';
const TIMEOUT_MS = 8_000;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Opora-Tenant': TENANT, ...init?.headers },
    });
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  listContractors: () =>
    req<{ contractors: ContractorRow[] }>('/v1/finance/contractors').then((r) => r.contractors),
  createContractor: (row: ContractorRow) =>
    req<unknown>('/v1/finance/contractors', {
      method: 'POST',
      body: JSON.stringify({ id: row.id, name: row.name, usedUah: row.usedUah, limitUah: row.limitUah }),
    }),
  patchContractor: (id: string, patch: Partial<Omit<ContractorRow, 'id'>>) =>
    req<unknown>(`/v1/finance/contractors/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteContractor: (id: string) =>
    req<unknown>(`/v1/finance/contractors/${id}`, { method: 'DELETE' }),

  listEmployees: () => req<{ employees: EmployeeRow[] }>('/v1/hr/employees').then((r) => r.employees),
  createEmployee: (row: EmployeeRow) =>
    req<unknown>('/v1/hr/employees', {
      method: 'POST',
      body: JSON.stringify({
        id: row.id,
        name: row.name,
        monthlySalaryUah: row.monthlySalaryUah,
        isMilitaryObliged: row.isMilitaryObliged,
      }),
    }),
  patchEmployee: (id: string, patch: Partial<Omit<EmployeeRow, 'id'>>) =>
    req<unknown>(`/v1/hr/employees/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteEmployee: (id: string) =>
    req<unknown>(`/v1/hr/employees/${id}`, { method: 'DELETE' }),

  getEnterprise: () => req<{ enterprise: EnterpriseBookingContext }>('/v1/hr/enterprise').then((r) => r.enterprise),
  putEnterprise: (ctx: EnterpriseBookingContext) =>
    req<unknown>('/v1/hr/enterprise', {
      method: 'PUT',
      body: JSON.stringify({
        territoryType: ctx.territoryType,
        hasCriticalStatus: ctx.hasCriticalEnterpriseStatus,
        isCriticalIndustry: ctx.isCriticalIndustry,
        hasTaxDebt: ctx.hasTaxDebt,
        obligatedCount: ctx.militaryObligatedCount,
        bookedCount: ctx.alreadyBookedCount,
      }),
    }),
};
