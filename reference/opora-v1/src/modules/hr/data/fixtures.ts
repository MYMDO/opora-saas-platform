import type { EmployeeRow, HrScenario } from '../domain/roster';

export const DEMO_ENTERPRISE = {
  territoryType: 'regular',
  hasCriticalEnterpriseStatus: true,
  isCriticalIndustry: false,
  hasTaxDebt: false,
  militaryObligatedCount: 20,
  alreadyBookedCount: 8,
} as const;

export const DEMO_EMPLOYEES: ReadonlyArray<EmployeeRow> = [
  { id: 'emp-1', name: 'Олена Коваленко', monthlySalaryUah: 31_000, isMilitaryObliged: false },
  { id: 'emp-2', name: 'Іван Гончар', monthlySalaryUah: 26_500, isMilitaryObliged: true },
  { id: 'emp-3', name: 'Марія Шевчук', monthlySalaryUah: 25_000, isMilitaryObliged: false },
  { id: 'emp-4', name: 'Андрій Лисенко', monthlySalaryUah: 22_000, isMilitaryObliged: true },
  { id: 'emp-5', name: 'Наталка Полтавка', monthlySalaryUah: 18_400, isMilitaryObliged: false },
];

export function defaultHrScenario(): HrScenario {
  return {
    employees: DEMO_EMPLOYEES.map((e) => ({ ...e })),
    enterprise: { ...DEMO_ENTERPRISE },
  };
}
