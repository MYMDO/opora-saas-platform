
export interface TaxRiskInput {
  readonly totalUsedUah: number;
  readonly totalSupplyLimitUah: number;
  readonly positiveTaxHistory: boolean;
  readonly daysToAdjustmentWindowClose: number | null;
  readonly invoiceBlockingsLast12m?: number;
}

export interface TaxRiskDrivers {
  readonly utilization: number;
  readonly historyPenalty: number;
  readonly adjustmentWindowUrgency: number;
  readonly blockingPenalty: number;
}

export interface TaxRiskAssessment {
  readonly scorePercent: number;
  readonly label: 'низький' | 'середній' | 'високий';
  readonly drivers: TaxRiskDrivers;
}

const WEIGHTS = {
  utilization: 0.4,
  historyPenalty: 0.3,
  adjustmentWindow: 0.2,
  blockingHistory: 0.1,
} as const;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function adjustmentWindowUrgency(daysLeft: number | null): number {
  if (daysLeft == null) return 0;
  if (daysLeft <= 5) return 1;
  return clamp01(1 - (daysLeft - 5) / 25);
}

export function assessTaxRisk(input: TaxRiskInput): TaxRiskAssessment {
  const drivers: TaxRiskDrivers = {
    utilization: clamp01(
      input.totalSupplyLimitUah > 0 ? input.totalUsedUah / input.totalSupplyLimitUah : 0,
    ),
    historyPenalty: input.positiveTaxHistory ? 0 : 1,
    adjustmentWindowUrgency: adjustmentWindowUrgency(input.daysToAdjustmentWindowClose),
    blockingPenalty: clamp01((input.invoiceBlockingsLast12m ?? 0) / 3),
  };

  const raw =
    WEIGHTS.utilization * drivers.utilization +
    WEIGHTS.historyPenalty * drivers.historyPenalty +
    WEIGHTS.adjustmentWindow * drivers.adjustmentWindowUrgency +
    WEIGHTS.blockingHistory * drivers.blockingPenalty;

  const scorePercent = Math.round(raw * 100);
  const label = scorePercent < 30 ? 'низький' : scorePercent < 60 ? 'середній' : 'високий';

  return { scorePercent, label, drivers };
}

