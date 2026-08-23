import { BOOKING_RULES, type TerritoryType } from './rules';

export interface EnterpriseBookingContext {
  readonly territoryType: TerritoryType;
  readonly hasCriticalEnterpriseStatus: boolean;
  readonly isCriticalIndustry: boolean;
  readonly hasTaxDebt: boolean;
  readonly militaryObligatedCount: number;
  readonly alreadyBookedCount: number;
}

export interface EmployeeBookingRequest {
  readonly monthlySalaryUah: number;
  /** Військовозобов'язаність: чоловіки 18–60 автоматично; жінки — за переліком МОУ №313 */
  readonly isMilitaryObliged: boolean;
}

export type BookingBlocker =
  | { readonly kind: 'not-military-obliged' }
  | { readonly kind: 'critical-status-missing' }
  | { readonly kind: 'tax-debt' }
  | { readonly kind: 'salary-below-threshold'; readonly requiredUah: number; readonly actualUah: number }
  | { readonly kind: 'quota-exhausted'; readonly limitSlots: number };

export interface BookingAssessment {
  readonly eligible: boolean;
  readonly blockers: ReadonlyArray<BookingBlocker>;
  readonly requiredSalaryThresholdUah: number;
  readonly quotaSlots: number;
}

export function salaryThreshold(ctx: EnterpriseBookingContext): number {
  return ctx.territoryType === 'frontline'
    ? BOOKING_RULES.frontlineSalaryThresholdUah
    : BOOKING_RULES.standardSalaryThresholdUah;
}

export function quotaPercent(ctx: EnterpriseBookingContext): number {
  return ctx.isCriticalIndustry
    ? BOOKING_RULES.criticalIndustryQuotaPercent
    : BOOKING_RULES.defaultQuotaPercent;
}

export function quotaSlots(ctx: EnterpriseBookingContext): number {
  return Math.floor((ctx.militaryObligatedCount * quotaPercent(ctx)) / 100);
}

export function remainingBookingSlots(ctx: EnterpriseBookingContext): number {
  return Math.max(0, quotaSlots(ctx) - ctx.alreadyBookedCount);
}

export function assessEmployeeBooking(
  request: EmployeeBookingRequest,
  ctx: EnterpriseBookingContext,
): BookingAssessment {
  const threshold = salaryThreshold(ctx);
  const slots = quotaSlots(ctx);

  // Бронювання застосовується лише до військовозобов'язаних: для решти перевірки нерелевантні.
  if (!request.isMilitaryObliged) {
    return {
      eligible: false,
      blockers: [{ kind: 'not-military-obliged' }],
      requiredSalaryThresholdUah: threshold,
      quotaSlots: slots,
    };
  }

  const blockers: BookingBlocker[] = [];

  if (!ctx.hasCriticalEnterpriseStatus) {
    blockers.push({ kind: 'critical-status-missing' });
  }
  if (ctx.hasTaxDebt) {
    blockers.push({ kind: 'tax-debt' });
  }
  if (request.monthlySalaryUah < threshold) {
    blockers.push({ kind: 'salary-below-threshold', requiredUah: threshold, actualUah: request.monthlySalaryUah });
  }
  if (ctx.alreadyBookedCount >= slots) {
    blockers.push({ kind: 'quota-exhausted', limitSlots: slots });
  }

  return { eligible: blockers.length === 0, blockers, requiredSalaryThresholdUah: threshold, quotaSlots: slots };
}
