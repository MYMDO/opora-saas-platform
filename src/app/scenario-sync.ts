import type { AppScenario } from './scenario';
import type { ContractorRow } from '../modules/finance/index';
import { api } from './api';

export interface RemoteSnapshot {
  contractors: ContractorRow[];
  employees: import('../modules/hr/index').EmployeeRow[];
  enterprise: import('../modules/hr/index').EnterpriseBookingContext | null;
}

export interface SeedPlan {
  contractors: ContractorRow[];
  employees: import('../modules/hr/index').EmployeeRow[];
  enterprise: import('../modules/hr/index').EnterpriseBookingContext | null;
}

export interface ReconcileResult {
  scenario: AppScenario;
  seed: SeedPlan;
}

function isPristineEnterprise(ctx: AppScenario['hr']['enterprise']): boolean {
  return (
    ctx.territoryType === 'regular' &&
    !ctx.hasCriticalEnterpriseStatus &&
    !ctx.isCriticalIndustry &&
    !ctx.hasTaxDebt &&
    ctx.militaryObligatedCount === 0 &&
    ctx.alreadyBookedCount === 0
  );
}

/**
 * Віддалені дані виграють, коли вони є. Порожній віддалений список
 * разом із локальними правками означає «хмара ще не засіяна» — тоді
 * локальні рядки повертаються у сценарій і плануються до висадки в API.
 */
export function reconcile(local: AppScenario, remote: RemoteSnapshot): ReconcileResult {
  const seed: SeedPlan = { contractors: [], employees: [], enterprise: null };

  let localContractors = local.finance.contractors;
  if (remote.contractors.length > 0) {
    localContractors = remote.contractors;
  } else if (localContractors.length > 0) {
    seed.contractors = [...localContractors];
  }

  let employees = local.hr.employees;
  if (remote.employees.length > 0) {
    employees = remote.employees;
  } else if (employees.length > 0) {
    seed.employees = [...employees];
  }

  let enterprise = local.hr.enterprise;
  const remoteEnterprise = remote.enterprise;
  if (remoteEnterprise) {
    enterprise = remoteEnterprise;
  } else if (!isPristineEnterprise(enterprise)) {
    seed.enterprise = enterprise;
  }

  return {
    scenario: {
      finance: { ...local.finance, contractors: localContractors },
      hr: { ...local.hr, employees, enterprise },
      energy: local.energy,
    },
    seed,
  };
}

export async function executeSeed(plan: SeedPlan): Promise<void> {
  for (const row of plan.contractors) await api.createContractor(row);
  for (const row of plan.employees) await api.createEmployee(row);
  if (plan.enterprise) await api.putEnterprise(plan.enterprise);
}
