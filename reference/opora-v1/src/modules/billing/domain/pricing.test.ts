import { describe, expect, it } from 'vitest';
import { computeMonthlyBill } from './pricing';

describe('computeMonthlyBill', () => {
  it('computes the Growth demo bill: fee + outcome beyond included + savings share', () => {
    const bill = computeMonthlyBill('growth', {
      resolutionsThisMonth: 626,
      verifiedMonthlySavingsUah: 300_000,
    });
    expect(bill.aiOutcome).toEqual({ billableResolutions: 526, amountUah: 19_988 });
    expect(bill.ems).toEqual({
      kind: 'savings-share',
      amountUah: 45_000,
      savingsBasisUah: 300_000,
      sharePercent: 15,
    });
    expect(bill.totalUah).toBe(74_888);
  });

  it('charges nothing for AI within the included allowance', () => {
    const bill = computeMonthlyBill('growth', {
      resolutionsThisMonth: 100,
      verifiedMonthlySavingsUah: 300_000,
    });
    expect(bill.aiOutcome.amountUah).toBe(0);
  });

  it('applies the minimum floor for the savings share', () => {
    const bill = computeMonthlyBill('growth', {
      resolutionsThisMonth: 100,
      verifiedMonthlySavingsUah: 10_000,
    });
    expect(bill.ems.kind === 'savings-share' && bill.ems.amountUah).toBe(3_900);
  });

  it('treats missing savings as zero basis before the floor', () => {
    const bill = computeMonthlyBill('growth', { resolutionsThisMonth: 100 });
    expect(bill.ems.kind === 'savings-share' && bill.ems.savingsBasisUah).toBe(0);
    expect(bill.ems.kind === 'savings-share' && bill.ems.amountUah).toBe(3_900);
  });

  it('uses a fixed monthly fee on Starter regardless of savings', () => {
    const bill = computeMonthlyBill('starter', {
      resolutionsThisMonth: 200,
      verifiedMonthlySavingsUah: 999_999,
    });
    expect(bill.ems.kind === 'fixed-monthly' && bill.ems.amountUah).toBe(1_900);
    expect(bill.platformFeeUah).toBe(4_900);
  });

  it('bills Enterprise by managed capacity', () => {
    const bill = computeMonthlyBill('enterprise', {
      resolutionsThisMonth: 700,
      managedCapacityKwh: 1600,
    });
    expect(bill.ems.kind === 'capacity-based' && bill.ems.amountUah).toBe(104_000);
    expect(bill.totalUah).toBe(24_900 + (700 - 500) * 28 + 104_000);
  });

  it('never bills negative AI outcome for zero usage', () => {
    const bill = computeMonthlyBill('enterprise', { resolutionsThisMonth: 0 });
    expect(bill.aiOutcome.amountUah).toBe(0);
  });
});
