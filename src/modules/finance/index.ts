import {
  assessTaxRisk,
  type TaxRiskAssessment,
} from './domain/riskScore';
import { daysUntil, deadlineTone, type ComplianceDeadline } from './domain/deadlines';
import { limitLevel, type LimitLevel } from './domain/taxRules';
import {
  defaultFinanceScenario,
  listedTotalUah,
  UNLISTED_CONTRACTORS_BASE_UAH,
  type FinanceScenario,
} from './domain/scenario';
import {
  COMPLIANCE_DEADLINES,
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

export function getFinanceSnapshot(
  scenario: FinanceScenario = defaultFinanceScenario(),
): FinanceSnapshot {
  const contractors: ContractorUsageView[] = scenario.contractors.map((c) => ({
    name: c.name,
    usedUah: c.usedUah,
    limitUah: c.limitUah,
    level: limitLevel(c.usedUah, c.limitUah),
  }));

  const totalUsedUah =
    UNLISTED_CONTRACTORS_BASE_UAH + listedTotalUah(scenario.contractors);

  const risk = assessTaxRisk({
    totalUsedUah,
    totalSupplyLimitUah: TOTAL_SUPPLY.limitUah,
    positiveTaxHistory: TAX_HISTORY.positiveTaxHistory,
    daysToAdjustmentWindowClose: scenario.adjustmentWindowDays,
    invoiceBlockingsLast12m: TAX_HISTORY.invoiceBlockingsLast12m,
  });

  const deadlines: DeadlineView[] = COMPLIANCE_DEADLINES.map((d) => {
    const daysLeft = daysUntil(d.dueDateIso);
    return { ...d, daysLeft, tone: deadlineTone(daysLeft) };
  });

  return {
    contractors,
    totals: { usedUah: totalUsedUah, limitUah: TOTAL_SUPPLY.limitUah },
    risk,
    deadlines,
  };
}

export { VAT_RULES, limitLevel, usagePercent } from './domain/taxRules';
export { assessTaxRisk, contractorsAtRisk } from './domain/riskScore';
export {
  addContractor,
  defaultFinanceScenario,
  removeContractor,
  updateContractor,
  UNLISTED_CONTRACTORS_BASE_UAH,
  type ContractorRow,
  type FinanceScenario,
} from './domain/scenario';
