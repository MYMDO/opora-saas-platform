import { describe, expect, it } from 'vitest';
import { assessTaxRisk, getFinanceSnapshot } from '../../finance/index';
import { defaultHrScenario } from '../../hr/index';
import { buildDailyActions, type DailyActionsInput } from './actions';

const DEMO_ENTERPRISE = defaultHrScenario().enterprise;

function financeStub(
  overrides: Partial<Parameters<typeof buildDailyActions>[0]['finance']> = {},
): DailyActionsInput['finance'] {
  return {
    contractors: [],
    deadlines: [],
    risk: assessTaxRisk({
      totalUsedUah: 0,
      totalSupplyLimitUah: 1_000_000,
      positiveTaxHistory: true,
      daysToAdjustmentWindowClose: null,
      invoiceBlockingsLast12m: 0,
    }),
    ...overrides,
  };
}

const base: DailyActionsInput = {
  finance: getFinanceSnapshot(),
  batterySocPercent: 82,
  booking: DEMO_ENTERPRISE,
  aiResolvedToday: 247,
};

describe('buildDailyActions', () => {
  it('ranks danger items first, then warnings, preserving insertion order', () => {
    const ids = buildDailyActions(base).map((a) => a.id);
    expect(ids.slice(0, 4)).toEqual([
      'contractor:ТОВ «Технобуд»',
      'deadline:vat-declaration',
      'contractor:ТОВ «Логістик Плюс»',
      'deadline:esv-booked-report',
    ]);
  });

  it('produces the expected severity mix for demo data', () => {
    const actions = buildDailyActions(base);
    const ids = actions.map((a) => a.id);
    const by = (s: string) => actions.filter((a) => a.severity === s).length;
    expect(by('danger')).toBe(2);
    expect(by('warning')).toBe(2);
    expect(by('info')).toBe(2);
    expect(ids).toContain('bess-reserve');
    expect(ids).toContain('booking-quota-low');
    expect(by('ok')).toBe(1);
  });

  it('excludes deadlines beyond two weeks', () => {
    const ids = buildDailyActions(base).map((a) => a.id);
    expect(ids).not.toContain('deadline:critical-enterprise-status');
  });

  it('flags exhausted booking quota as warning and drops the near-limit hint', () => {
    const actions = buildDailyActions({
      ...base,
      booking: { ...DEMO_ENTERPRISE, alreadyBookedCount: 10 },
    });
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('booking-quota-exhausted');
    expect(ids).not.toContain('booking-quota-low');
    expect(actions.find((a) => a.id === 'booking-quota-exhausted')?.severity).toBe('warning');
  });

  it('adds a tax-risk action only when the score is high', () => {
    expect(buildDailyActions(base).map((a) => a.id)).not.toContain('tax-risk-high');

    const risky = buildDailyActions({
      ...base,
      finance: financeStub({
        risk: assessTaxRisk({
          totalUsedUah: 950_000,
          totalSupplyLimitUah: 1_000_000,
          positiveTaxHistory: false,
          daysToAdjustmentWindowClose: 3,
        }),
      }),
    });
    expect(risky.map((a) => a.id)).toContain('tax-risk-high');
  });

  it('returns an empty list when everything is calm', () => {
    const calm = buildDailyActions({
      finance: financeStub(),
      batterySocPercent: 40,
      booking: { ...DEMO_ENTERPRISE, militaryObligatedCount: 0 },
      aiResolvedToday: 0,
    });
    expect(calm).toEqual([]);
  });
});
