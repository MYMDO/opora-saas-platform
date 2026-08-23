import type { EnterpriseBookingContext } from '../domain/booking';

export const DEMO_ENTERPRISE: EnterpriseBookingContext = {
  territoryType: 'regular',
  hasCriticalEnterpriseStatus: true,
  isCriticalIndustry: false,
  hasTaxDebt: false,
  militaryObligatedCount: 20,
  alreadyBookedCount: 8,
};

export const DEMO_EMPLOYEE_SALARY_UAH = 26_000;
