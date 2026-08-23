export type TerritoryType = 'regular' | 'frontline';

/** Постанова КМУ №692: правила бронювання військовозобов'язаних */
export const BOOKING_RULES = {
  /** Поріг зарплати заброньованого працівника: 3 мінімальні зарплати */
  standardSalaryThresholdUah: 25_941,
  /** Виняток для прифронтових територій */
  frontlineSalaryThresholdUah: 21_600,
  /** Строк розгляду заявки держорганом */
  reviewDaysLimit: 10,
  /** Стандартний ліміт бронювання */
  defaultQuotaPercent: 50,
  /** Ліміт для критичних галузей */
  criticalIndustryQuotaPercent: 100,
} as const;
