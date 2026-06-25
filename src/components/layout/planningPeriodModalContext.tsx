"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import { NewPlanningPeriodModal } from "../posts/NewPlanningPeriodModal";

type PlanningPeriodModalContextValue = {
  openNewPlanningPeriod: (sourcePeriodId?: string) => void;
};

const PlanningPeriodModalContext = createContext<PlanningPeriodModalContextValue | null>(
  null
);

export function PlanningPeriodModalProvider({ children }: { children: ReactNode }) {
  const { planningPeriods, createPlanningPeriod } = useClientWorkspace();
  const [open, setOpen] = useState(false);
  const [sourcePeriodId, setSourcePeriodId] = useState<string | undefined>();

  const openNewPlanningPeriod = useCallback((source?: string) => {
    setSourcePeriodId(source);
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ openNewPlanningPeriod }),
    [openNewPlanningPeriod]
  );

  return (
    <PlanningPeriodModalContext.Provider value={value}>
      {children}
      <NewPlanningPeriodModal
        open={open}
        onClose={() => {
          setOpen(false);
          setSourcePeriodId(undefined);
        }}
        periods={planningPeriods}
        defaultSourcePeriodId={sourcePeriodId}
        onSubmit={async (options) => {
          await createPlanningPeriod(options);
        }}
      />
    </PlanningPeriodModalContext.Provider>
  );
}

export function usePlanningPeriodModal() {
  const ctx = useContext(PlanningPeriodModalContext);
  if (!ctx) {
    throw new Error("usePlanningPeriodModal must be used within PlanningPeriodModalProvider");
  }
  return ctx;
}
