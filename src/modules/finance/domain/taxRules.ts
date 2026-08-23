export const VAT_RULES = {
  totalSupplyLimitUah: 1_000_000,
  perContractorLimitUah: 100_000,
  warningThreshold: 0.7,
  dangerThreshold: 0.9,
} as const;

export type LimitLevel = 'safe' | 'warning' | 'danger';

export function usagePercent(usedUah: number, limitUah: number): number {
  if (limitUah <= 0) return 0;
  return Math.min(100, Math.round((usedUah / limitUah) * 100));
}

export function limitLevel(usedUah: number, limitUah: number): LimitLevel {
  const ratio = limitUah > 0 ? usedUah / limitUah : 0;
  if (ratio >= VAT_RULES.dangerThreshold) return 'danger';
  if (ratio >= VAT_RULES.warningThreshold) return 'warning';
  return 'safe';
}
