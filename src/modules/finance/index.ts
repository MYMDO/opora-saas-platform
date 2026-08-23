import {
  assessTaxRisk,
  type TaxRiskAssessment,
} from './domain/riskScore';
import { daysUntil, deadlineTone, type ComplianceDeadline } from './domain/deadlines';
import { limitLevel, type LimitLevel } from './domain/taxRules';
import {
  ADJUSTMENT_WINDOW_DAYS_TO_CLOSE,
  COMPLIANCE_DEADLINES,
  CONTRACTORS,
  TAX_HISTORY,
  TOTAL_SUPPLY,
} from './data/fixtures';

export interface ContractorUsageView {
  readonly name: string;
  readonly usedUah: number;
  readonly limitUah: number;
  readonly level: LimitLevel;
}

export interface DeadlineView extends ComplianceDeadline {
  readonly daysLeft: number;
  readonly tone: 'danger' | 'neutral';
}

export interface FinanceSnapshot {
  readonly contractors: ReadonlyArray<ContractorUsageView>;
  readonly totals: { readonly usedUah: number; readonly limitUah: number };
  readonly risk: TaxRiskAssessment;
  readonly deadlines: ReadonlyArray<DeadlineView>;
}

export function getFinanceSnapshot(): FinanceSnapshot {
  const contractors: ContractorUsageView[] = CONTRACTORS.map((c) => ({
    name: c.name,
    usedUah: c.usedUah,
    limitUah: c.limitUah,
    level: limitLevel(c.usedUah, c.limitUah),
  }));

  const risk = assessTaxRisk({
    totalUsedUah: TOTAL_SUPPLY.usedUah,
    totalSupplyLimitUah: TOTAL_SUPPLY.limitUah,
    positiveTaxHistory: TAX_HISTORY.positiveTaxHistory,
    daysToAdjustmentWindowClose: ADJUSTMENT_WINDOW_DAYS_TO_CLOSE,
    invoiceBlockingsLast12m: TAX_HISTORY.invoiceBlockingsLast12m,
  });

  const deadlines: DeadlineView[] = COMPLIANCE_DEADLINES.map((d) => {
    const daysLeft = daysUntil(d.dueDateIso);
    return { ...d, daysLeft, tone: deadlineTone(daysLeft) };
  });

  return { contractors, totals: { ...TOTAL_SUPPLY }, risk, deadlines };
}

export { VAT_RULES, limitLevel, usagePercent } from './domain/taxRules';
export { assessTaxRisk, contractorsAtRisk } from './domain/riskScore';
