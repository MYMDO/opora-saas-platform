import { describe, expect, it } from 'vitest';
import { assessTaxRisk } from './riskScore';

const baseInput = {
  totalUsedUah: 612_000,
  totalSupplyLimitUah: 1_000_000,
  positiveTaxHistory: true,
  daysToAdjustmentWindowClose: 12,
  invoiceBlockingsLast12m: 0,
};

describe('assessTaxRisk', () => {
  it('clean taxpayer with no deadlines scores zero', () => {
    const r = assessTaxRisk({
      totalUsedUah: 0,
      totalSupplyLimitUah: 1_000_000,
      positiveTaxHistory: true,
      daysToAdjustmentWindowClose: null,
      invoiceBlockingsLast12m: 0,
    });
    expect(r.scorePercent).toBe(0);
    expect(r.label).toBe('низький');
  });

  it('fixture-like case lands in the middle band', () => {
    const r = assessTaxRisk(baseInput);
    // utilization 0.612*0.4 + history 0 + window urgency (12d -> 0.72)*0.2 = 0.3888
    expect(r.scorePercent).toBe(39);
    expect(r.label).toBe('середній');
  });

  it('is monotonic in total utilization', () => {
    const low = assessTaxRisk({ ...baseInput, totalUsedUah: 200_000 });
    const high = assessTaxRisk({ ...baseInput, totalUsedUah: 900_000 });
    expect(high.scorePercent).toBeGreaterThan(low.scorePercent);
  });

  it('broken tax history adds a fixed penalty', () => {
    const clean = assessTaxRisk(baseInput);
    const dirty = assessTaxRisk({ ...baseInput, positiveTaxHistory: false });
    expect(dirty.scorePercent - clean.scorePercent).toBe(30);
  });

  it('overdue deadline saturates window urgency at 1', () => {
    const overdue = assessTaxRisk({ ...baseInput, daysToAdjustmentWindowClose: -3 });
    const fiveDays = assessTaxRisk({ ...baseInput, daysToAdjustmentWindowClose: 5 });
    expect(overdue.scorePercent).toBe(fiveDays.scorePercent);
  });

  it('blocking history saturates after three blockings', () => {
    const three = assessTaxRisk({ ...baseInput, invoiceBlockingsLast12m: 3 });
    const ten = assessTaxRisk({ ...baseInput, invoiceBlockingsLast12m: 10 });
    expect(ten.scorePercent).toBe(three.scorePercent);
  });
});
