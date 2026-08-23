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
export {
  assessBookingRoster,
  type EmployeeRow,
  type HrScenario,
  type RosterAssessment,
  type RosterRowResult,
} from './domain/roster';
export { DEMO_EMPLOYEES, defaultHrScenario } from './data/fixtures';
export { BookingComplianceCard } from './ui/BookingComplianceCard';
