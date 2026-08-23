import {
  DEMO_BESS_INVESTMENT_UAH,
  type ArbitrageParams,
} from '../modules/energy/index';
import { defaultFinanceScenario, type ContractorRow, type FinanceScenario } from '../modules/finance/index';
import { defaultHrScenario, type EmployeeRow, type EnterpriseBookingContext, type HrScenario } from '../modules/hr/index';

export interface EnergyScenarioState {
  overrides: Partial<ArbitrageParams>;
  investmentUah: number;
}

export interface AppScenario {
  readonly finance: FinanceScenario;
  readonly hr: HrScenario;
  readonly energy: EnergyScenarioState;
}

export function defaults(): AppScenario {
  return {
    finance: defaultFinanceScenario(),
    hr: defaultHrScenario(),
    energy: { overrides: {}, investmentUah: DEMO_BESS_INVESTMENT_UAH },
  };
}

export const SCENARIO_STORAGE_KEY = 'opora-scenario-v1';

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function safeId(raw: unknown): string {
  return typeof raw === 'string' && ID_RE.test(raw) ? raw : crypto.randomUUID();
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampNum(v: unknown, min: number, max?: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const x = Math.max(min, v);
  return max == null ? x : Math.min(x, max);
}

export function sanitizeArbitrageOverrides(raw: unknown): Partial<ArbitrageParams> {
  if (raw == null || typeof raw !== 'object') return {};
  const s = raw as Record<string, unknown>;
  const out: Partial<ArbitrageParams> = {};
  const put = <K extends keyof ArbitrageParams>(
    key: K,
    min: number,
    max?: number,
    floorInt = false,
  ) => {
    const v = clampNum(s[key as string], min, max);
    if (v !== undefined) (out[key] as number) = floorInt ? Math.floor(v) : v;
  };
  put('batteryCapacityKwh', 0, 1_000_000);
  put('maxDodPercent', 0, 100);
  put('roundTripEfficiencyPercent', 20, 100);
  put('cyclesPerDay', 0, 6, true);
  put('chargePriceUahPerKwh', 0, 10_000);
  put('dischargePriceUahPerKwh', 0, 10_000);
  put('degradationCostUahPerKwh', 0, 10_000);
  return out;
}

function parseContractors(raw: unknown, fallback: ReadonlyArray<ContractorRow>): FinanceScenario['contractors'] {
  if (!Array.isArray(raw)) return fallback;
  return raw
    .filter(
      (r): r is Record<string, unknown> =>
        r != null &&
        typeof r.name === 'string' &&
        Number.isFinite(r.usedUah) &&
        Number.isFinite(r.limitUah),
    )
    .map((r) => ({
      id: safeId(r.id),
      name: String(r.name),
      usedUah: Number(r.usedUah),
      limitUah: Number(r.limitUah),
    }));
}

function parseEmployees(raw: unknown, fallback: ReadonlyArray<EmployeeRow>): HrScenario['employees'] {
  if (!Array.isArray(raw)) return fallback;
  return raw
    .filter(
      (r): r is Record<string, unknown> =>
        r != null &&
        typeof r.name === 'string' &&
        Number.isFinite(r.monthlySalaryUah),
    )
    .map((r) => ({
      // Легасі-рядки без прапорця вважаємо військовозобов'язаними (консервативно).
      id: safeId(r.id),
      name: String(r.name),
      monthlySalaryUah: Number(r.monthlySalaryUah),
      isMilitaryObliged: r.isMilitaryObliged !== false,
    }));
}

function parseEnterprise(raw: unknown, fallback: EnterpriseBookingContext): EnterpriseBookingContext {
  if (raw == null || typeof raw !== 'object') return fallback;
  const e = raw as Record<string, unknown>;
  return {
    territoryType: e.territoryType === 'frontline' ? 'frontline' : 'regular',
    hasCriticalEnterpriseStatus: e.hasCriticalEnterpriseStatus === true,
    isCriticalIndustry: e.isCriticalIndustry === true,
    hasTaxDebt: e.hasTaxDebt === true,
    militaryObligatedCount: Math.max(0, toFiniteNumber(e.militaryObligatedCount, fallback.militaryObligatedCount)),
    alreadyBookedCount: Math.max(0, toFiniteNumber(e.alreadyBookedCount, fallback.alreadyBookedCount)),
  };
}

type StorageLike = { getItem(key: string): string | null };

/** Захисне читання сценарію: будь-яке сміття у сховищі відкатується до дефолтів. */
export function loadInitial(storage?: StorageLike): AppScenario {
  const d = defaults();
  const store = storage ?? (globalThis as { localStorage?: StorageLike }).localStorage;
  try {
    const raw = store?.getItem(SCENARIO_STORAGE_KEY);
    if (!raw) return d;
    const parsed = JSON.parse(raw) as Partial<AppScenario> | null;

    const f = parsed?.finance;
    return {
      finance: {
        adjustmentWindowDays: Math.max(
          0,
          toFiniteNumber(f?.adjustmentWindowDays, d.finance.adjustmentWindowDays),
        ),
        contractors: parseContractors(f?.contractors, d.finance.contractors),
      },
      hr: {
        employees: parseEmployees(parsed?.hr?.employees, d.hr.employees),
        enterprise: parseEnterprise(parsed?.hr?.enterprise, d.hr.enterprise),
      },
      energy: {
        overrides: sanitizeArbitrageOverrides(parsed?.energy?.overrides),
        investmentUah: Math.max(0, toFiniteNumber(parsed?.energy?.investmentUah, d.energy.investmentUah)),
      },
    };
  } catch {
    return d;
  }
}
