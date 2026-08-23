/** Ринкові орієнтири НКРЕКП / РДН, ₴ за кВт·год */
export const MARKET_TARIFFS = {
  nightUahPerKwh: 2.5,
  dayUahPerKwh: 4.1,
  peakUahPerKwh: 9,
} as const;

export interface ArbitrageParams {
  readonly batteryCapacityKwh: number;
  readonly maxDodPercent: number;
  readonly roundTripEfficiencyPercent: number;
  readonly cyclesPerDay: number;
  readonly chargePriceUahPerKwh: number;
  readonly dischargePriceUahPerKwh: number;
  readonly degradationCostUahPerKwh: number;
}

export const DEFAULT_ARBITRAGE: Omit<ArbitrageParams, 'batteryCapacityKwh'> = {
  maxDodPercent: 80,
  roundTripEfficiencyPercent: 92,
  cyclesPerDay: 2,
  chargePriceUahPerKwh: MARKET_TARIFFS.nightUahPerKwh,
  dischargePriceUahPerKwh: MARKET_TARIFFS.peakUahPerKwh,
  degradationCostUahPerKwh: 0.53,
};

export function computeDailySavingsUah(params: ArbitrageParams): number {
  const usableKwh = Math.max(0, params.batteryCapacityKwh * (params.maxDodPercent / 100));
  const eta = params.roundTripEfficiencyPercent / 100;
  const perCycle =
    usableKwh *
    (params.dischargePriceUahPerKwh -
      params.chargePriceUahPerKwh / eta -
      params.degradationCostUahPerKwh);
  return Math.round(Math.max(0, perCycle) * params.cyclesPerDay);
}

export function computePaybackYears(investmentUah: number, dailySavingsUah: number): number | null {
  if (dailySavingsUah <= 0 || investmentUah <= 0) return null;
  return investmentUah / dailySavingsUah / 365;
}

export function computeBreakEvenDischargeUahPerKwh(
  params: Pick<
    ArbitrageParams,
    'chargePriceUahPerKwh' | 'roundTripEfficiencyPercent' | 'degradationCostUahPerKwh'
  >,
): number {
  const eta = params.roundTripEfficiencyPercent / 100;
  return params.chargePriceUahPerKwh / eta + params.degradationCostUahPerKwh;
}
