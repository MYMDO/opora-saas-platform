import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addContractor,
  removeContractor as removeContractorOp,
  updateContractor as updateContractorOp,
  VAT_RULES,
  defaultFinanceScenario,
  type ContractorRow,
  type FinanceScenario,
} from '../modules/finance/index';
import {
  defaultHrScenario,
  type EmployeeRow,
  type EnterpriseBookingContext,
  type HrScenario,
} from '../modules/hr/index';
import {
  DEMO_BESS_INVESTMENT_UAH,
  type ArbitrageParams,
} from '../modules/energy/index';

export interface EnergyScenarioState {
  overrides: Partial<ArbitrageParams>;
  investmentUah: number;
}

export interface AppScenario {
  readonly finance: FinanceScenario;
  readonly hr: HrScenario;
  readonly energy: EnergyScenarioState;
}

function defaults(): AppScenario {
  return {
    finance: defaultFinanceScenario(),
    hr: defaultHrScenario(),
    energy: { overrides: {}, investmentUah: DEMO_BESS_INVESTMENT_UAH },
  };
}

const STORAGE_KEY = 'opora-scenario-v1';

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampNum(v: unknown, min: number, max?: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const x = Math.max(min, v);
  return max == null ? x : Math.min(x, max);
}

function sanitizeArbitrageOverrides(raw: unknown): Partial<ArbitrageParams> {
  if (raw == null || typeof raw !== 'object') return {};
  const s = raw as Record<string, unknown>;
  const out: Partial<ArbitrageParams> = {};
  const put = <K extends keyof ArbitrageParams>(key: K, min: number, max?: number, floorInt = false) => {
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

function loadInitial(): AppScenario {
  const d = defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return d;
    const parsed = JSON.parse(raw) as Partial<AppScenario> | null;

    const f = parsed?.finance;
    const finance: FinanceScenario = {
      adjustmentWindowDays: Math.max(
        0,
        toFiniteNumber(f?.adjustmentWindowDays, d.finance.adjustmentWindowDays),
      ),
      contractors: Array.isArray(f?.contractors)
        ? f.contractors
            .filter(
              (r): r is ContractorRow =>
                r != null &&
                typeof r.name === 'string' &&
                Number.isFinite(r.usedUah) &&
                Number.isFinite(r.limitUah),
            )
            .map((r) => ({ name: String(r.name), usedUah: Number(r.usedUah), limitUah: Number(r.limitUah) }))
        : d.finance.contractors,
    };

    const e = parsed?.hr?.enterprise;
    const enterprise: EnterpriseBookingContext = {
      territoryType: e?.territoryType === 'frontline' ? 'frontline' : 'regular',
      hasCriticalEnterpriseStatus: e?.hasCriticalEnterpriseStatus === true,
      isCriticalIndustry: e?.isCriticalIndustry === true,
      hasTaxDebt: e?.hasTaxDebt === true,
      militaryObligatedCount: Math.max(0, toFiniteNumber(e?.militaryObligatedCount, d.hr.enterprise.militaryObligatedCount)),
      alreadyBookedCount: Math.max(0, toFiniteNumber(e?.alreadyBookedCount, d.hr.enterprise.alreadyBookedCount)),
    };

    const employees: ReadonlyArray<EmployeeRow> = Array.isArray(parsed?.hr?.employees)
      ? parsed.hr.employees
          .filter(
            (r): r is EmployeeRow =>
              r != null &&
              typeof r.id === 'string' &&
              typeof r.name === 'string' &&
              Number.isFinite(r.monthlySalaryUah),
          )
          .map((r) => ({
            id: String(r.id),
            name: String(r.name),
            monthlySalaryUah: Number(r.monthlySalaryUah),
          }))
      : d.hr.employees;

    const energy: EnergyScenarioState = {
      overrides: sanitizeArbitrageOverrides(parsed?.energy?.overrides),
      investmentUah: Math.max(
        0,
        toFiniteNumber(parsed?.energy?.investmentUah, d.energy.investmentUah),
      ),
    };

    return { finance, hr: { employees, enterprise }, energy };
  } catch {
    return d;
  }
}
interface ScenarioContextValue {
  readonly scenario: AppScenario;
  updateContractor(index: number, patch: Partial<ContractorRow>): void;
  addContractor(name: string): void;
  removeContractor(index: number): void;
  addEmployee(name: string, monthlySalaryUah: number): void;
  updateEmployee(id: string, patch: Partial<Omit<EmployeeRow, 'id'>>): void;
  removeEmployee(id: string): void;
  updateEnterprise(patch: Partial<EnterpriseBookingContext>): void;
  updateEnergy(patch: { overrides?: Partial<ArbitrageParams>; investmentUah?: number }): void;
  resetScenario(): void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

let employeeSeq = 0;

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<AppScenario>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario));
    } catch {
      // приватний режим або переповнений сховищ-квота — сценарій лишається лише в памʼяті
    }
  }, [scenario]);

  const value = useMemo<ScenarioContextValue>(
    () => ({
      scenario,
      updateContractor: (index, patch) =>
        setScenario((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            contractors: updateContractorOp(prev.finance.contractors, index, patch),
          },
        })),
      addContractor: (name) =>
        setScenario((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            contractors: addContractor(prev.finance.contractors, name, VAT_RULES.perContractorLimitUah),
          },
        })),
      removeContractor: (index) =>
        setScenario((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            contractors: removeContractorOp(prev.finance.contractors, index),
          },
        })),
      addEmployee: (name, monthlySalaryUah) =>
        setScenario((prev) => {
          const clean = name.trim();
          if (!clean) return prev;
          employeeSeq += 1;
          const row: EmployeeRow = {
            id: `emp-${Date.now()}-${employeeSeq}`,
            name: clean,
            monthlySalaryUah: Math.max(0, monthlySalaryUah),
          };
          return { ...prev, hr: { ...prev.hr, employees: [...prev.hr.employees, row] } };
        }),
      updateEmployee: (id, patch) =>
        setScenario((prev) => ({
          ...prev,
          hr: {
            ...prev.hr,
            employees: prev.hr.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          },
        })),
      removeEmployee: (id) =>
        setScenario((prev) => ({
          ...prev,
          hr: {
            ...prev.hr,
            employees: prev.hr.employees.filter((e) => e.id !== id),
          },
        })),
      updateEnterprise: (patch) =>
        setScenario((prev) => ({
          ...prev,
          hr: { ...prev.hr, enterprise: { ...prev.hr.enterprise, ...patch } },
        })),
      updateEnergy: (patch) =>
        setScenario((prev) => ({
          ...prev,
          energy: {
            overrides:
              patch.overrides === undefined
                ? prev.energy.overrides
                : { ...prev.energy.overrides, ...patch.overrides },
            investmentUah: patch.investmentUah ?? prev.energy.investmentUah,
          },
        })),
      resetScenario: () => setScenario(defaults()),
    }),
    [scenario],
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be used within ScenarioProvider');
  return ctx;
}
