import type { ComplianceDeadline } from '../domain/deadlines';

export interface ContractorUsageFixture {
  readonly name: string;
  readonly usedUah: number;
  readonly limitUah: number;
}

export const CONTRACTORS: ReadonlyArray<ContractorUsageFixture> = [
  { name: 'ТОВ «Технобуд»', usedUah: 97_500, limitUah: 100_000 },
  { name: 'ТОВ «Логістик Плюс»', usedUah: 82_000, limitUah: 100_000 },
  { name: 'ФОП Коваленко І. В.', usedUah: 45_300, limitUah: 100_000 },
  { name: 'ТОВ «Агро-Сервіс»', usedUah: 21_000, limitUah: 100_000 },
];

export const TOTAL_SUPPLY = {
  usedUah: 612_000,
  limitUah: 1_000_000,
} as const;

export const TAX_HISTORY = {
  positiveTaxHistory: true,
  invoiceBlockingsLast12m: 0,
} as const;

export const ADJUSTMENT_WINDOW_DAYS_TO_CLOSE = 12;

function isoInDays(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export const COMPLIANCE_DEADLINES: ReadonlyArray<ComplianceDeadline> = [
  { id: 'vat-declaration', title: 'Декларація з ПДВ', dueDateIso: isoInDays(3) },
  { id: 'esv-booked-report', title: 'Звіт ЄСВ по заброньованих працівниках', dueDateIso: isoInDays(11) },
  {
    id: 'critical-enterprise-status',
    title: 'Підтвердження статусу критичного підприємства',
    dueDateIso: isoInDays(18),
  },
];

export const RISK_TREND = [
  { m: 'Лют', score: 22 },
  { m: 'Бер', score: 19 },
  { m: 'Кві', score: 24 },
  { m: 'Тра', score: 16 },
  { m: 'Чер', score: 14 },
  { m: 'Лип', score: 12 },
];
