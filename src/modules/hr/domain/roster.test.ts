import { describe, expect, it } from 'vitest';
import { DEMO_ENTERPRISE } from '../data/fixtures';
import { assessBookingRoster, type EmployeeRow } from './roster';

const employees: EmployeeRow[] = [
  { id: 'e1', name: 'Олена Коваленко', monthlySalaryUah: 31_000 },
  { id: 'e2', name: 'Іван Гончар', monthlySalaryUah: 26_500 },
  { id: 'e3', name: 'Марія Шевчук', monthlySalaryUah: 25_000 },
  { id: 'e4', name: 'Андрій Лисенко', monthlySalaryUah: 22_000 },
  { id: 'e5', name: 'Наталка Полтавка', monthlySalaryUah: 18_400 },
];

describe('assessBookingRoster', () => {
  it('approves only salaries above the standard threshold with free quota', () => {
    const r = assessBookingRoster(employees, DEMO_ENTERPRISE);
    expect(r.eligibleCount).toBe(2);
    expect(r.rows.find((row) => row.id === 'e1')?.eligible).toBe(true);
    expect(r.rows.find((row) => row.id === 'e3')?.eligible).toBe(false);
  });

  it('flips borderline salaries on frontline territories', () => {
    const r = assessBookingRoster(employees, {
      ...DEMO_ENTERPRISE,
      territoryType: 'frontline',
    });
    expect(r.eligibleCount).toBe(4);
    expect(r.rows.find((row) => row.id === 'e4')?.eligible).toBe(true);
  });

  it('marks everyone ineligible when the quota is exhausted', () => {
    const r = assessBookingRoster(employees, {
      ...DEMO_ENTERPRISE,
      alreadyBookedCount: 10,
    });
    expect(r.eligibleCount).toBe(0);
    expect(r.rows.every((row) => row.blockers.some((b) => b.kind === 'quota-exhausted'))).toBe(
      true,
    );
  });

  it('handles an empty roster', () => {
    expect(assessBookingRoster([], DEMO_ENTERPRISE)).toEqual({ rows: [], eligibleCount: 0 });
  });
});
