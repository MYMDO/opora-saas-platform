import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  addContractor,
  removeContractor,
  updateContractor,
  VAT_RULES,
  defaultFinanceScenario,
  type ContractorRow,
  type FinanceScenario,
} from '../modules/finance/index';

interface ScenarioContextValue {
  readonly finance: FinanceScenario;
  updateContractor(index: number, patch: Partial<ContractorRow>): void;
  addContractor(name: string): void;
  removeContractor(index: number): void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [finance, setFinance] = useState<FinanceScenario>(() => defaultFinanceScenario());

  const value = useMemo<ScenarioContextValue>(
    () => ({
      finance,
      updateContractor: (index, patch) =>
        setFinance((prev) => ({
          ...prev,
          contractors: updateContractor(prev.contractors, index, patch),
        })),
      addContractor: (name) =>
        setFinance((prev) => ({
          ...prev,
          contractors: addContractor(
            prev.contractors,
            name,
            VAT_RULES.perContractorLimitUah,
          ),
        })),
      removeContractor: (index) =>
        setFinance((prev) => ({
          ...prev,
          contractors: removeContractor(prev.contractors, index),
        })),
    }),
    [finance],
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be used within ScenarioProvider');
  return ctx;
}
