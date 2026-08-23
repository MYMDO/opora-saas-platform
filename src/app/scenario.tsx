import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addContractor as addContractorOp,
  removeContractor as removeContractorOp,
  updateContractor as updateContractorOp,
  VAT_RULES,
  type ContractorRow,
} from '../modules/finance/index';
import type { EmployeeRow, EnterpriseBookingContext } from '../modules/hr/index';
import type { ArbitrageParams } from '../modules/energy/index';
import { api } from './api';
import { executeSeed, reconcile } from './scenario-sync';
import {
  defaults,
  loadInitial,
  SCENARIO_STORAGE_KEY,
  type AppScenario,
  type EnergyScenarioState,
} from './scenario-storage';

export type { AppScenario, EnergyScenarioState };

interface ScenarioContextValue {
  readonly scenario: AppScenario;
  readonly apiOnline: boolean | null;
  readonly syncError: string | null;
  updateContractor(index: number, patch: Partial<Omit<ContractorRow, 'id'>>): void;
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

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<AppScenario>(loadInitial);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenario));
    } catch {
      // приватний режим або переповнена квота — сценарій лишається лише в памʼяті
    }
  }, [scenario]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [contractors, employees, enterprise] = await Promise.all([
          api.listContractors(),
          api.listEmployees(),
          api.getEnterprise(),
        ]);
        if (cancelled) return;
        const { scenario: next, seed } = reconcile(loadInitial(), {
          contractors,
          employees,
          enterprise,
        });
        setScenario(next);
        if (seed.contractors.length > 0 || seed.employees.length > 0 || seed.enterprise) {
          await executeSeed(seed);
        }
        if (!cancelled) setApiOnline(true);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn('[ОПОРА] API недоступний — працюємо на локальному сценарії:', err);
        if (!cancelled) {
          setApiOnline(false);
          setSyncError(reason.slice(0, 120));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ScenarioContextValue>(() => {
    const sync = (p: Promise<unknown>) => p.catch((e) => console.warn('[ОПОРА] sync:', e));

    return {
      scenario,
      apiOnline,
      syncError,
      updateContractor: (index, patch) => {
        const row = scenario.finance.contractors[index];
        setScenario((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            contractors: updateContractorOp(prev.finance.contractors, index, patch),
          },
        }));
        if (row) sync(api.patchContractor(row.id, patch));
      },
      addContractor: (name) => {
        const row: ContractorRow = {
          id: crypto.randomUUID(),
          name: name.trim(),
          usedUah: 0,
          limitUah: VAT_RULES.perContractorLimitUah,
        };
        setScenario((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            contractors: addContractorOp(prev.finance.contractors, name, row.limitUah),
          },
        }));
        sync(api.createContractor(row));
      },
      removeContractor: (index) => {
        const row = scenario.finance.contractors[index];
        setScenario((prev) => ({
          ...prev,
          finance: {
            ...prev.finance,
            contractors: removeContractorOp(prev.finance.contractors, index),
          },
        }));
        if (row) sync(api.deleteContractor(row.id));
      },
      addEmployee: (name, monthlySalaryUah) => {
        const clean = name.trim();
        if (!clean) return;
        const row: EmployeeRow = {
          id: crypto.randomUUID(),
          name: clean,
          monthlySalaryUah: Math.max(0, monthlySalaryUah),
        };
        setScenario((prev) => ({
          ...prev,
          hr: { ...prev.hr, employees: [...prev.hr.employees, row] },
        }));
        sync(api.createEmployee(row));
      },
      updateEmployee: (id, patch) => {
        setScenario((prev) => ({
          ...prev,
          hr: {
            ...prev.hr,
            employees: prev.hr.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          },
        }));
        sync(api.patchEmployee(id, patch));
      },
      removeEmployee: (id) => {
        setScenario((prev) => ({
          ...prev,
          hr: { ...prev.hr, employees: prev.hr.employees.filter((e) => e.id !== id) },
        }));
        sync(api.deleteEmployee(id));
      },
      updateEnterprise: (patch) => {
        const next = { ...scenario.hr.enterprise, ...patch };
        setScenario((prev) => ({
          ...prev,
          hr: { ...prev.hr, enterprise: { ...prev.hr.enterprise, ...patch } },
        }));
        sync(api.putEnterprise(next));
      },
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
      resetScenario: () => {
        setScenario(defaults());
        void (async () => {
          try {
            const [cs, es] = await Promise.all([api.listContractors(), api.listEmployees()]);
            await Promise.all([
              ...cs.map((c) => api.deleteContractor(c.id)),
              ...es.map((e) => api.deleteEmployee(e.id)),
            ]);
            await api.putEnterprise(defaults().hr.enterprise);
          } catch (e) {
            console.warn('[ОПОРА] reset cloud sync:', e);
          }
        })();
      },
    };
  }, [scenario, apiOnline, syncError]);

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be used within ScenarioProvider');
  return ctx;
}
