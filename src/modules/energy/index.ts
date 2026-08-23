import {
  computeDailySavingsUah,
  computePaybackYears,
  DEFAULT_ARBITRAGE,
  type ArbitrageParams,
} from './domain/arbitrage';
import { DEMO_BESS, DEMO_BESS_INVESTMENT_UAH } from './data/fixtures';

export interface EnergySnapshot {
  readonly socPercent: number;
  readonly capacityLabel: string;
  readonly generationTodayKwh: number;
  readonly savedTodayUah: number;
  readonly paybackYears: number | null;
}

export function getEnergySnapshot(): EnergySnapshot {
  const params: ArbitrageParams = {
    ...DEFAULT_ARBITRAGE,
    batteryCapacityKwh: DEMO_BESS.capacityKwh,
  };
  const savedTodayUah = computeDailySavingsUah(params);
  return {
    socPercent: DEMO_BESS.socPercent,
    capacityLabel: `${DEMO_BESS.powerKw} кВт / ${DEMO_BESS.capacityKwh} кВт·год`,
    generationTodayKwh: DEMO_BESS.generationTodayKwh,
    savedTodayUah,
    paybackYears: computePaybackYears(DEMO_BESS_INVESTMENT_UAH, savedTodayUah),
  };
}

export { MARKET_TARIFFS, DEFAULT_ARBITRAGE, computeDailySavingsUah, computePaybackYears } from './domain/arbitrage';
export {
  DEMO_BESS,
  DEMO_BESS_INVESTMENT_UAH,
  ENERGY_24H,
  WEEK_SAVINGS,
  MPC_EXPLANATION,
} from './data/fixtures';
