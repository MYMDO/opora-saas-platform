export const DEMO_BESS = {
  powerKw: 800,
  capacityKwh: 1600,
  socPercent: 82,
  generationTodayKwh: 312,
} as const;

/** Орієнтовна вартість під ключ (обладнання + монтаж), ₴ */
export const DEMO_BESS_INVESTMENT_UAH = 18_200_000;

export const ENERGY_24H = [
  { h: '00', gen: 0, cons: 14, batt: 61 },
  { h: '02', gen: 0, cons: 11, batt: 54 },
  { h: '04', gen: 0, cons: 10, batt: 47 },
  { h: '06', gen: 2, cons: 18, batt: 41 },
  { h: '08', gen: 21, cons: 34, batt: 38 },
  { h: '10', gen: 48, cons: 39, batt: 52 },
  { h: '12', gen: 63, cons: 41, batt: 71 },
  { h: '14', gen: 58, cons: 40, batt: 86 },
  { h: '16', gen: 39, cons: 42, batt: 92 },
  { h: '18', gen: 12, cons: 55, batt: 80 },
  { h: '20', gen: 0, cons: 51, batt: 64 },
  { h: '22', gen: 0, cons: 27, batt: 62 },
];

export const WEEK_SAVINGS = [
  { day: 'Пн', without: 41_200, with: 29_600 },
  { day: 'Вт', without: 39_800, with: 27_100 },
  { day: 'Ср', without: 43_500, with: 30_800 },
  { day: 'Чт', without: 45_100, with: 30_380 },
  { day: 'Пт', without: 47_600, with: 33_200 },
  { day: 'Сб', without: 28_300, with: 21_900 },
  { day: 'Нд', without: 22_100, with: 17_400 },
];

export const MPC_EXPLANATION =
  'MPC-алгоритм враховує прогноз погоди й графік споживання, лінеаризує криву деградації акумулятора (DOD) та обирає момент заряду/розряду так, щоб продовжити ресурс батареї й мінімізувати рахунок.';
