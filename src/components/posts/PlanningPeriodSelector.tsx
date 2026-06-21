"use client";

import { CalendarRange, ChevronDown, Copy, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlanningPeriod } from "../../lib/planningConstants";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

function statusLabel(status: PlanningPeriod["status"]) {
  if (status === "active") return "Ativo";
  if (status === "archived") return "Arquivado";
  return "Rascunho";
}

export function PlanningPeriodSelector({
  periods,
  activePeriodId,
  isReadOnly,
  onSelect,
  onCreateNew,
  onDuplicate,
}: {
  periods: PlanningPeriod[];
  activePeriodId: string;
  isReadOnly: boolean;
  onSelect: (periodId: string) => void;
  onCreateNew: () => void;
  onDuplicate?: (sourcePeriodId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = periods.find((p) => p.id === activePeriodId) ?? periods[0];

  const sorted = useMemo(
    () =>
      [...periods].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      ),
    [periods]
  );

  return (
    <div className="relative mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-ag-border/70 bg-ag-surface-2 shadow-[var(--ag-shadow-sm)]">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="rounded-lg bg-ag-accent-soft p-2 text-ag-accent shrink-0">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-mono uppercase tracking-wider text-ag-muted font-semibold">
              Roteiro / planejamento
            </p>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 flex items-center gap-2 text-left w-full group"
            >
              <span className="font-display text-lg font-semibold text-ag-text truncate">
                {active?.label ?? "Roteiro"}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-ag-muted shrink-0 transition-transform",
                  open && "rotate-180"
                )}
              />
            </button>
            <p className="text-xs text-ag-muted mt-1">
              Início: {active?.startDate ?? "—"}
              {active && (
                <span
                  className={cn(
                    "ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    active.status === "active"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-ag-surface text-ag-muted"
                  )}
                >
                  {statusLabel(active.status)}
                </span>
              )}
              {isReadOnly && (
                <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                  Somente leitura
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isReadOnly && onDuplicate && active && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDuplicate(active.id)}
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicar como base
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onCreateNew}>
            <Plus className="h-3.5 w-3.5" />
            Novo roteiro
          </Button>
        </div>
      </div>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Fechar lista de roteiros"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-ag-border bg-ag-surface shadow-[var(--ag-shadow-lg)] overflow-hidden">
            <ul className="max-h-64 overflow-y-auto py-1">
              {sorted.map((period) => {
                const selected = period.id === activePeriodId;
                return (
                  <li key={period.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(period.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full px-4 py-3 text-left hover:bg-ag-surface-2 transition-colors",
                        selected && "bg-ag-accent-soft/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-ag-text truncate">
                          {period.label}
                        </span>
                        <span className="text-[10px] font-semibold text-ag-muted shrink-0">
                          {statusLabel(period.status)}
                        </span>
                      </div>
                      <p className="text-xs text-ag-muted mt-0.5">
                        {period.startDate}
                        {typeof period.filledPostsCount === "number" &&
                          period.filledPostsCount > 0 && (
                            <span className="ml-2">· {period.filledPostsCount} posts</span>
                          )}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export function PlanningPeriodReadOnlyBanner({
  periodLabel,
  onDuplicate,
}: {
  periodLabel: string;
  onDuplicate: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p className="text-sm text-ag-text">
        Você está visualizando o roteiro arquivado <strong>{periodLabel}</strong>. Edição
        desabilitada — exporte ou duplique como base para um novo mês.
      </p>
      <Button variant="secondary" size="sm" onClick={onDuplicate} className="shrink-0">
        <Copy className="h-3.5 w-3.5" />
        Duplicar para novo mês
      </Button>
    </div>
  );
}
