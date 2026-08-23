import { describe, expect, it } from 'vitest';
import {
  computeBreakEvenDischargeUahPerKwh,
  computeDailySavingsUah,
  computePaybackYears,
  DEFAULT_ARBITRAGE,
} from './arbitrage';

const base: Parameters<typeof computeDailySavingsUah>[number] = {
  ...DEFAULT_ARBITRAGE,
  batteryCapacityKwh: 1600,
};

describe('computeBreakEvenDischargeUahPerKwh', () => {
  it('equals charging losses plus degradation cost', () => {
    const be = computeBreakEvenDischargeUahPerKwh(base);
    expect(be).toBeCloseTo(2.5 / 0.92 + 0.53, 9);
  });

  it('is the exact threshold where daily savings hit zero', () => {
    const be = computeBreakEvenDischargeUahPerKwh(base);
    expect(computeDailySavingsUah({ ...base, dischargePriceUahPerKwh: be })).toBe(0);
  });

  it('rises with the night tariff and efficiency losses', () => {
    const cheaperNight = computeBreakEvenDischargeUahPerKwh({ ...base, chargePriceUahPerKwh: 2 });
    expect(cheaperNight).toBeLessThan(computeBreakEvenDischargeUahPerKwh(base));
    const worseEta = computeBreakEvenDischargeUahPerKwh({
      ...base,
      roundTripEfficiencyPercent: 80,
    });
    expect(worseEta).toBeGreaterThan(computeBreakEvenDischargeUahPerKwh(base));
  });
});

describe('computeDailySavingsUah', () => {
  it('reproduces the demo case: 1600 kWh, 80% DoD, 92% efficiency, 2 cycles', () => {
    // usable 1280 kWh; per cycle 1280 * (9 - 2.5/0.92 - 0.53) ≈ 7363; ×2 ≈ 14727
    expect(computeDailySavingsUah(base)).toBe(14_727);
  });

  it('scales linearly with capacity', () => {
    const half = computeDailySavingsUah({ ...base, batteryCapacityKwh: 800 });
    expect(half).toBe(7_363);
    expect(Math.abs(half - 14_727 / 2)).toBeLessThanOrEqual(1);
  });

  it('is zero for an empty battery', () => {
    expect(computeDailySavingsUah({ ...base, batteryCapacityKwh: 0 })).toBe(0);
  });

  it('never returns negative savings for upside-down spreads', () => {
    const inverted = { ...base, dischargePriceUahPerKwh: 1 };
    expect(computeDailySavingsUah(inverted)).toBe(0);
  });

  it('charges for input losses through round-trip efficiency', () => {
    const perfectEta = computeDailySavingsUah({ ...base, roundTripEfficiencyPercent: 100 });
    expect(perfectEta).toBeGreaterThan(computeDailySavingsUah(base));
  });
});

describe('computePaybackYears', () => {
  it('matches the demo investment of 18.2M UAH', () => {
    const savings = computeDailySavingsUah(base);
    const years = computePaybackYears(18_200_000, savings)!;
    expect(years).toBeCloseTo(3.386, 2);
  });

  it('returns null when there are no savings', () => {
    expect(computePaybackYears(18_200_000, 0)).toBeNull();
    expect(computePaybackYears(18_200_000, -5)).toBeNull();
  });

  it('returns null when investment is missing', () => {
    expect(computePaybackYears(0, 10_000)).toBeNull();
  });
});
