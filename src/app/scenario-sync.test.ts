import { describe, expect, it } from 'vitest';
import { defaultFinanceScenario } from '../modules/finance/index';
import { defaultHrScenario } from '../modules/hr/index';
import { defaults } from './scenario';
import { reconcile } from './scenario-sync';

function localScenario() {
  return defaults();
}

describe('reconcile', () => {
  it('remote data wins when present', () => {
    const local = localScenario();
    const remote = {
      contractors: [{ id: 'r1', name: 'Віддалений', usedUah: 1, limitUah: 100 }],
      employees: [{ id: 're1', name: 'Працівник', monthlySalaryUah: 20_000 }],
      enterprise: {
        territoryType: 'frontline' as const,
        hasCriticalEnterpriseStatus: true,
        isCriticalIndustry: false,
        hasTaxDebt: false,
        militaryObligatedCount: 5,
        alreadyBookedCount: 1,
      },
    };
    const r = reconcile(local, remote);
    expect(r.scenario.finance.contractors).toEqual(remote.contractors);
    expect(r.scenario.hr.employees).toEqual(remote.employees);
    expect(r.scenario.hr.enterprise).toEqual(remote.enterprise);
    expect(r.seed.contractors).toHaveLength(0);
  });

  it('plans a seed when remote is empty and local has edits', () => {
    const local = localScenario();
    const r = reconcile(local, { contractors: [], employees: [], enterprise: null });
    expect(r.scenario.finance.contractors).toEqual(local.finance.contractors);
    expect(r.seed.contractors).toEqual(local.finance.contractors);
    expect(r.seed.employees).toEqual(local.hr.employees);
  });

  it('remote pristine enterprise still wins (cloud is source of truth)', () => {
    const local = localScenario();
    const pristine = {
      territoryType: 'regular' as const,
      hasCriticalEnterpriseStatus: false,
      isCriticalIndustry: false,
      hasTaxDebt: false,
      militaryObligatedCount: 0,
      alreadyBookedCount: 0,
    };
    const r = reconcile(local, { contractors: [], employees: [], enterprise: pristine });
    expect(r.scenario.hr.enterprise).toEqual(pristine);
    expect(r.seed.enterprise).toBeNull();
  });

  it('seeds non-pristine local enterprise when cloud has no row', () => {
    const local = localScenario();
    const r = reconcile(local, { contractors: [], employees: [], enterprise: null });
    expect(r.scenario.hr.enterprise).toEqual(defaultHrScenario().enterprise);
    expect(r.seed.enterprise).toEqual(defaultHrScenario().enterprise);
  });

  it('defaults remain intact as the local baseline', () => {
    expect(defaultFinanceScenario().contractors.length).toBeGreaterThan(0);
    expect(defaults().energy.investmentUah).toBeGreaterThan(0);
  });
});
