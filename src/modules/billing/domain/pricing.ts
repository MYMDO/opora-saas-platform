export type PlanId = 'starter' | 'growth' | 'enterprise';

/** Модель монетизації енергомодуля залежно від тарифного плану */
export type EmsBilling =
  | { readonly kind: 'fixed-monthly'; readonly monthlyFeeUah: number }
  | {
      readonly kind: 'savings-share';
      readonly sharePercent: number;
      readonly minimumMonthlyUah: number;
    }
  | { readonly kind: 'capacity-based'; readonly uahPerKwhCapacityMonth: number };

export interface Plan {
  readonly id: PlanId;
  readonly label: string;
  readonly platformFeeUah: number;
  readonly pricePerResolutionUah: number;
  readonly includedResolutions: number;
  readonly ems: EmsBilling;
}

/** Гібридна модель ціноутворення: фікс + оплата за результат + оплата за використання */
export const PLANS: Readonly<Record<PlanId, Plan>> = {
  starter: {
    id: 'starter',
    label: 'Starter',
    platformFeeUah: 4_900,
    pricePerResolutionUah: 49,
    includedResolutions: 50,
    ems: { kind: 'fixed-monthly', monthlyFeeUah: 1_900 },
  },
  growth: {
    id: 'growth',
    label: 'Growth',
    platformFeeUah: 9_900,
    pricePerResolutionUah: 38,
    includedResolutions: 100,
    ems: { kind: 'savings-share', sharePercent: 15, minimumMonthlyUah: 3_900 },
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    platformFeeUah: 24_900,
    pricePerResolutionUah: 28,
    includedResolutions: 500,
    ems: { kind: 'capacity-based', uahPerKwhCapacityMonth: 65 },
  },
};

export interface BillingUsageInput {
  readonly resolutionsThisMonth: number;
  readonly verifiedMonthlySavingsUah?: number;
  readonly managedCapacityKwh?: number;
}

export interface AiOutcomeComponent {
  readonly billableResolutions: number;
  readonly amountUah: number;
}

export type EmsComponent =
  | { readonly kind: 'fixed-monthly'; readonly amountUah: number }
  | {
      readonly kind: 'savings-share';
      readonly amountUah: number;
      readonly savingsBasisUah: number;
      readonly sharePercent: number;
    }
  | { readonly kind: 'capacity-based'; readonly amountUah: number; readonly capacityKwh: number };

export interface MonthlyBill {
  readonly plan: Plan;
  readonly platformFeeUah: number;
  readonly aiOutcome: AiOutcomeComponent;
  readonly ems: EmsComponent;
  readonly totalUah: number;
}

function computeEmsComponent(ems: EmsBilling, usage: BillingUsageInput): EmsComponent {
  switch (ems.kind) {
    case 'fixed-monthly':
      return { kind: 'fixed-monthly', amountUah: ems.monthlyFeeUah };
    case 'savings-share': {
      const basis = Math.max(0, usage.verifiedMonthlySavingsUah ?? 0);
      const raw = Math.round((basis * ems.sharePercent) / 100);
      return {
        kind: 'savings-share',
        amountUah: Math.max(raw, ems.minimumMonthlyUah),
        savingsBasisUah: basis,
        sharePercent: ems.sharePercent,
      };
    }
    case 'capacity-based': {
      const capacity = Math.max(0, usage.managedCapacityKwh ?? 0);
      return {
        kind: 'capacity-based',
        amountUah: Math.round(capacity * ems.uahPerKwhCapacityMonth),
        capacityKwh: capacity,
      };
    }
  }
}

export function computeMonthlyBill(planId: PlanId, usage: BillingUsageInput): MonthlyBill {
  const plan = PLANS[planId];
  const billableResolutions = Math.max(
    0,
    usage.resolutionsThisMonth - plan.includedResolutions,
  );
  const aiOutcome: AiOutcomeComponent = {
    billableResolutions,
    amountUah: billableResolutions * plan.pricePerResolutionUah,
  };
  const ems = computeEmsComponent(plan.ems, usage);
  return {
    plan,
    platformFeeUah: plan.platformFeeUah,
    aiOutcome,
    ems,
    totalUah: plan.platformFeeUah + aiOutcome.amountUah + ems.amountUah,
  };
}
