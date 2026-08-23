import { describe, expect, it } from 'vitest';
import { DEMO_ENTERPRISE } from '../data/fixtures';
import { assessBookingRoster, type EmployeeRow } from './roster';

const employees: EmployeeRow[] = [
  // Жінка без військово-облікової спеціальності — бронювання не застосовується
  { id: 'e1', name: 'Олена Коваленко', monthlySalaryUah: 31_000, isMilitaryObliged: false },
  // Військовозобов'язані (чоловіки та жінки за переліком МОУ)
  { id: 'e2', name: 'Іван Гончар', monthlySalaryUah: 26_500, isMilitaryObliged: true },
  { id: 'e3', name: 'Марія Шевчук (фармацевтка)', monthlySalaryUah: 25_000, isMilitaryObliged: true },
  { id: 'e4', name: 'Андрій Лисенко', monthlySalaryUah: 22_000, isMilitaryObliged: true },
  { id: 'e5', name: 'Наталка Полтавка', monthlySalaryUah: 18_400, isMilitaryObliged: false },
];

describe('assessBookingRoster', () => {
  it('assesses only military-obligated employees against the threshold', () => {
    const r = assessBookingRoster(employees, DEMO_ENTERPRISE);
    expect(r.eligibleCount).toBe(1);
    expect(r.rows.find((row) => row.id === 'e2')?.eligible).toBe(true);
    expect(r.rows.find((row) => row.id === 'e3')?.blockers.some((b) => b.kind === 'salary-below-threshold')).toBe(
      true,
    );
  });

  it('flags non-obligated employees as not applicable regardless of salary', () => {
    const r = assessBookingRoster(employees, DEMO_ENTERPRISE);
    const exemptHighEarner = r.rows.find((row) => row.id === 'e1');
    expect(exemptHighEarner?.eligible).toBe(false);
    expect(exemptHighEarner?.blockers[0]?.kind).toBe('not-military-obliged');
  });

  it('applies the frontline threshold to obligated women as well', () => {
    const r = assessBookingRoster(employees, {
      ...DEMO_ENTERPRISE,
      territoryType: 'frontline',
    });
    // Іван (26.5), Марія (25), Андрій (22 ≥ 21.6) — жінка-необовʼязкова досі поза контекстом
    expect(r.eligibleCount).toBe(3);
  });

  it('marks every obligated employee when the quota is exhausted', () => {
    const r = assessBookingRoster(employees, {
      ...DEMO_ENTERPRISE,
      alreadyBookedCount: 10,
    });
    expect(r.eligibleCount).toBe(0);
    const obligatedRows = r.rows.filter((row) => row.isMilitaryObliged);
    expect(
      obligatedRows.every((row) => row.blockers.some((b) => b.kind === 'quota-exhausted')),
    ).toBe(true);
  });

  it('handles an empty roster', () => {
    expect(assessBookingRoster([], DEMO_ENTERPRISE)).toEqual({ rows: [], eligibleCount: 0 });
  });
});
