export { BOOKING_RULES, type TerritoryType } from './domain/rules';
export {
  assessEmployeeBooking,
  quotaPercent,
  quotaSlots,
  remainingBookingSlots,
  salaryThreshold,
  type BookingAssessment,
  type BookingBlocker,
  type EmployeeBookingRequest,
  type EnterpriseBookingContext,
} from './domain/booking';
export { DEMO_ENTERPRISE, DEMO_EMPLOYEE_SALARY_UAH } from './data/fixtures';
export { BookingComplianceCard } from './ui/BookingComplianceCard';
