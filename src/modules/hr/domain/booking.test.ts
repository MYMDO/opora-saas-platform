import { describe, expect, it } from 'vitest';
import { assessEmployeeBooking, quotaSlots, remainingBookingSlots } from './booking';
import type { EnterpriseBookingContext } from './booking';

const baseCtx: EnterpriseBookingContext = {
  territoryType: 'regular',
  hasCriticalEnterpriseStatus: true,
  isCriticalIndustry: false,
  hasTaxDebt: false,
  militaryObligatedCount: 20,
  alreadyBookedCount: 8,
};

describe('assessEmployeeBooking', () => {
  it('approves a compliant candidate', () => {
    const r = assessEmployeeBooking({ isMilitaryObliged: true, monthlySalaryUah: 26_000 }, baseCtx);
    expect(r.eligible).toBe(true);
    expect(r.blockers).toHaveLength(0);
    expect(r.requiredSalaryThresholdUah).toBe(25_941);
  });

  it('rejects salary below the standard threshold', () => {
    const r = assessEmployeeBooking({ isMilitaryObliged: true, monthlySalaryUah: 25_000 }, baseCtx);
    expect(r.eligible).toBe(false);
    expect(r.blockers).toContainEqual({
      kind: 'salary-below-threshold',
      requiredUah: 25_941,
      actualUah: 25_000,
    });
  });

  it('applies the frontline exception threshold', () => {
    const frontline = { ...baseCtx, territoryType: 'frontline' as const };
    expect(assessEmployeeBooking({ isMilitaryObliged: true, monthlySalaryUah: 22_000 }, frontline).eligible).toBe(true);
    expect(assessEmployeeBooking({ isMilitaryObliged: true, monthlySalaryUah: 22_000 }, baseCtx).eligible).toBe(false);
    expect(assessEmployeeBooking({ isMilitaryObliged: true, monthlySalaryUah: 21_500 }, frontline).eligible).toBe(false);
  });

  it('flags tax debt', () => {
    const r = assessEmployeeBooking({ isMilitaryObliged: true, monthlySalaryUah: 30_000 }, { ...baseCtx, hasTaxDebt: true });
    expect(r.blockers.some((b) => b.kind === 'tax-debt')).toBe(true);
  });

  it('flags missing critical enterprise status', () => {
    const r = assessEmployeeBooking(
      { isMilitaryObliged: true, monthlySalaryUah: 30_000 },
      { ...baseCtx, hasCriticalEnterpriseStatus: false },
    );
    expect(r.blockers.some((b) => b.kind === 'critical-status-missing')).toBe(true);
  });

  it('enforces the 50% default quota', () => {
    const ctx = { ...baseCtx, alreadyBookedCount: 10 };
    const r = assessEmployeeBooking({ isMilitaryObliged: true, monthlySalaryUah: 30_000 }, ctx);
    expect(r.blockers).toContainEqual({ kind: 'quota-exhausted', limitSlots: 10 });
  });

  it('raises quota to 100% for critical industries', () => {
    const ctx = { ...baseCtx, isCriticalIndustry: true, alreadyBookedCount: 15 };
    const r = assessEmployeeBooking({ isMilitaryObliged: true, monthlySalaryUah: 30_000 }, ctx);
    expect(r.eligible).toBe(true);
    expect(r.quotaSlots).toBe(20);
  });

  it('reports all blockers at once', () => {
    const ctx: EnterpriseBookingContext = {
      territoryType: 'regular',
      hasCriticalEnterpriseStatus: false,
      isCriticalIndustry: false,
      hasTaxDebt: true,
      militaryObligatedCount: 4,
      alreadyBookedCount: 2,
    };
    const r = assessEmployeeBooking({ isMilitaryObliged: true, monthlySalaryUah: 10_000 }, ctx);
    expect(r.eligible).toBe(false);
    expect(r.blockers.map((b) => b.kind)).toEqual([
      'critical-status-missing',
      'tax-debt',
      'salary-below-threshold',
      'quota-exhausted',
    ]);
  });
});

describe('quota math', () => {
  it('floors fractional slots', () => {
    expect(quotaSlots({ ...baseCtx, militaryObligatedCount: 7 })).toBe(3);
  });

  it('never returns negative remaining slots', () => {
    expect(remainingBookingSlots({ ...baseCtx, alreadyBookedCount: 99 })).toBe(0);
  });
});

describe('military liability gate', () => {
  it('short-circuits non-obligated employees before any other checks', () => {
    const r = assessEmployeeBooking({ isMilitaryObliged: false, monthlySalaryUah: 50_000 }, baseCtx);
    expect(r.eligible).toBe(false);
    expect(r.blockers).toEqual([{ kind: 'not-military-obliged' }]);
    expect(r.requiredSalaryThresholdUah).toBe(25_941);
  });
});
