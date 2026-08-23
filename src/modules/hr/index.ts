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
export { BookingComplianceCard } from './ui/BookingComplianceCard';
