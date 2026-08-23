import {
  ADJUSTMENT_WINDOW_DAYS_TO_CLOSE,
  CONTRACTORS,
  TOTAL_SUPPLY,
} from '../data/fixtures';

export interface ContractorRow {
  name: string;
  usedUah: number;
  limitUah: number;
}

export interface FinanceScenario {
  readonly contractors: ReadonlyArray<ContractorRow>;
  readonly adjustmentWindowDays: number;
}

export function defaultFinanceScenario(): FinanceScenario {
  return {
    contractors: CONTRACTORS.map((c) => ({ name: c.name, usedUah: c.usedUah, limitUah: c.limitUah })),
    adjustmentWindowDays: ADJUSTMENT_WINDOW_DAYS_TO_CLOSE,
  };
}

const INITIAL_LISTED_TOTAL_UAH = CONTRACTORS.reduce((sum, c) => sum + c.usedUah, 0);

/** Обсяги контрагентів поза топ-списком: 612k − 245.8k */
export const UNLISTED_CONTRACTORS_BASE_UAH = Math.max(
  0,
  TOTAL_SUPPLY.usedUah - INITIAL_LISTED_TOTAL_UAH,
);

export function updateContractor(
  rows: ReadonlyArray<ContractorRow>,
  index: number,
  patch: Partial<ContractorRow>,
): ContractorRow[] {
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
}

export function addContractor(
  rows: ReadonlyArray<ContractorRow>,
  name: string,
  limitUah: number,
): ContractorRow[] {
  const clean = name.trim();
  if (!clean) return [...rows];
  return [...rows, { name: clean, usedUah: 0, limitUah }];
}

export function removeContractor(
  rows: ReadonlyArray<ContractorRow>,
  index: number,
): ContractorRow[] {
  return rows.filter((_, i) => i !== index);
}

export function listedTotalUah(rows: ReadonlyArray<ContractorRow>): number {
  return rows.reduce((sum, r) => sum + r.usedUah, 0);
}
