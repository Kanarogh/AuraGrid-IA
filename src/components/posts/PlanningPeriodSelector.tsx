"use client";

import { CalendarRange, ChevronDown, Copy, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  toolbar,
  hideDuplicateAction = false,
}: {
  periods: PlanningPeriod[];
  activePeriodId: string;
  isReadOnly: boolean;
  onSelect: (periodId: string) => void;
  onCreateNew: () => void;
  onDuplicate?: (sourcePeriodId: string) => void;
  toolbar?: ReactNode;
  hideDuplicateAction?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = periods.find((p) => p.id === activePeriodId) ?? periods[0];

  const sorted = [...periods].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="rounded-xl border border-ag-border/70 bg-ag-surface shadow-[var(--ag-shadow-sm)] overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-ag-surface-2">
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
              aria-expanded={open}
              aria-haspopup="listbox"
              className="mt-1 flex items-center gap-2 text-left w-full group max-w-full"
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
            <p className="text-xs text-ag-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Início: {active?.startDate ?? "—"}</span>
              {active && (
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    active.status === "active"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-ag-surface text-ag-muted"
                  )}
                >
                  {statusLabel(active.status)}
                </span>
              )}
              {isReadOnly && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Somente leitura
                </span>
              )}
            </p>
          </div>
        </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:self-start">
            {isReadOnly && onDuplicate && active && !hideDuplicateAction && (
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
        <div
          role="listbox"
          className="border-t border-ag-border/60 bg-ag-surface"
        >
          <ul className="max-h-64 overflow-y-auto py-1">
            {sorted.map((period) => {
              const selected = period.id === activePeriodId;
              return (
                <li key={period.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
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
      )}

      {toolbar && (
        <div className="border-t border-ag-border/60 bg-ag-surface px-4 py-3">{toolbar}</div>
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
