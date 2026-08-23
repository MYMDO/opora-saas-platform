import { assessEmployeeBooking, type BookingAssessment, type EnterpriseBookingContext } from './booking';

export interface EmployeeRow {
  readonly id: string;
  readonly name: string;
  readonly monthlySalaryUah: number;
  /** Чи перебуває особа на військовому обліку (чоловіки 18–60; жінки — за переліком МОУ №313) */
  readonly isMilitaryObliged: boolean;
}

export interface HrScenario {
  readonly employees: ReadonlyArray<EmployeeRow>;
  readonly enterprise: EnterpriseBookingContext;
}

export interface RosterRowResult extends BookingAssessment {
  readonly id: string;
  readonly name: string;
  readonly monthlySalaryUah: number;
  readonly isMilitaryObliged: boolean;
}

export interface RosterAssessment {
  readonly rows: ReadonlyArray<RosterRowResult>;
  readonly eligibleCount: number;
}

export function assessBookingRoster(
  employees: ReadonlyArray<EmployeeRow>,
  ctx: EnterpriseBookingContext,
): RosterAssessment {
  const rows = employees.map((e) => ({
    id: e.id,
    name: e.name,
    monthlySalaryUah: e.monthlySalaryUah,
    isMilitaryObliged: e.isMilitaryObliged,
    ...assessEmployeeBooking(
      { monthlySalaryUah: e.monthlySalaryUah, isMilitaryObliged: e.isMilitaryObliged },
      ctx,
    ),
  }));
  return { rows, eligibleCount: rows.filter((r) => r.eligible).length };
}
