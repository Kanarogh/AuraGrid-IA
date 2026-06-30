"use client";

import { CalendarRange, ChevronDown, Copy, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PlanningPeriod } from "../../lib/planningConstants";
import type { PlanningPeriodEditMode } from "../../lib/clientWorkspace/types";
import { confirmDialog } from "../../lib/confirmDialog";
import {
  buildDisableReferencesConfirmMessage,
  resolveUsesReferences,
} from "../../lib/referenceWorkflow";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

function statusLabel(status: PlanningPeriod["status"]) {
  if (status === "active") return "Ativo";
  if (status === "archived") return "Arquivado";
  return "Rascunho";
}

function modeIndicator(mode: PlanningPeriodEditMode, periodStatus: PlanningPeriod["status"]) {
  if (mode === "edit_archived") return "Editando arquivado";
  if (mode === "view_archived" || periodStatus === "archived") return "Visualizando";
  return null;
}

export function PlanningPeriodSelector({
  periods,
  activePeriodId,
  isReadOnly,
  periodEditMode = "active",
  usesReferences = true,
  periodUsesReferencesOverride,
  clientDefaultUsesReferences = true,
  indexedReferenceCount = 0,
  storedReferenceCount = 0,
  onPeriodUsesReferencesChange,
  onSelect,
  onCreateNew,
  onDuplicate,
  toolbar,
  hideDuplicateAction = false,
}: {
  periods: PlanningPeriod[];
  activePeriodId: string;
  isReadOnly: boolean;
  periodEditMode?: PlanningPeriodEditMode;
  usesReferences?: boolean;
  periodUsesReferencesOverride?: boolean | null;
  clientDefaultUsesReferences?: boolean;
  indexedReferenceCount?: number;
  storedReferenceCount?: number;
  onPeriodUsesReferencesChange?: (value: boolean | null) => void;
  onSelect: (periodId: string) => void;
  onCreateNew: () => void;
  onDuplicate?: (sourcePeriodId: string) => void;
  toolbar?: ReactNode;
  hideDuplicateAction?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = periods.find((p) => p.id === activePeriodId) ?? periods[0];
  const modeLabel = active ? modeIndicator(periodEditMode, active.status) : null;

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
              Planejamento
            </p>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="listbox"
              className="mt-1 flex items-center gap-2 text-left w-full group max-w-full"
            >
              <span className="font-display text-lg font-semibold text-ag-text truncate">
                {active?.label ?? "Planejamento"}
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
                      ? "bg-ag-success/15 text-ag-success"
                      : "bg-ag-surface text-ag-muted"
                  )}
                >
                  {statusLabel(active.status)}
                </span>
              )}
              {modeLabel && (
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    periodEditMode === "edit_archived"
                      ? "bg-ag-accent/15 text-ag-accent"
                      : "bg-ag-warning/15 text-ag-warning"
                  )}
                >
                  {modeLabel}
                </span>
              )}
              {!usesReferences && (
                <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-ag-accent/15 text-ag-accent">
                  Sem referências
                </span>
              )}
              {isReadOnly && (
                <span className="text-ag-warning font-medium">
                  Somente leitura
                </span>
              )}
            </p>
            {onPeriodUsesReferencesChange && !isReadOnly && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-ag-muted font-semibold">
                  Referências
                </label>
                <select
                  value={
                    periodUsesReferencesOverride === true
                      ? "on"
                      : periodUsesReferencesOverride === false
                        ? "off"
                        : "inherit"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    const nextOverride =
                      v === "on" ? true : v === "off" ? false : null;
                    void (async () => {
                      const nextEffective = resolveUsesReferences(
                        clientDefaultUsesReferences,
                        nextOverride
                      );
                      if (
                        usesReferences &&
                        !nextEffective &&
                        indexedReferenceCount > 0
                      ) {
                        const ok = await confirmDialog({
                          message: buildDisableReferencesConfirmMessage(
                            indexedReferenceCount
                          ),
                          confirmLabel: "Desativar",
                        });
                        if (!ok) return;
                      }
                      await onPeriodUsesReferencesChange?.(nextOverride);
                    })();
                  }}
                  className="rounded-lg border border-ag-border bg-ag-surface px-2 py-1 text-xs text-ag-text"
                >
                  <option value="inherit">Herdar do cliente</option>
                  <option value="on">Com referências</option>
                  <option value="off">Sem referências</option>
                </select>
                {!usesReferences && storedReferenceCount > 0 && (
                  <p className="text-[10px] text-ag-muted w-full">
                    {storedReferenceCount} referência
                    {storedReferenceCount !== 1 ? "s" : ""} deste planejamento{" "}
                    {storedReferenceCount === 1 ? "está" : "estão"} guardada
                    {storedReferenceCount !== 1 ? "s" : ""} e oculta
                    {storedReferenceCount !== 1 ? "s" : ""}.
                  </p>
                )}
              </div>
            )}
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
            Novo planejamento
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
  onReactivate,
  onEditInPlace,
  onDuplicate,
}: {
  periodLabel: string;
  onReactivate: () => void;
  onEditInPlace: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-ag-warning/30 bg-ag-warning/10 px-4 py-3 flex flex-col gap-3">
      <p className="text-sm text-ag-text">
        Você está visualizando o planejamento arquivado <strong>{periodLabel}</strong>. Escolha como
        prosseguir:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={onReactivate}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reativar planejamento
        </Button>
        <Button variant="secondary" size="sm" onClick={onEditInPlace}>
          <Pencil className="h-3.5 w-3.5" />
          Editar sem trocar o ativo
        </Button>
        <Button variant="secondary" size="sm" onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5" />
          Duplicar como base
        </Button>
      </div>
    </div>
  );
}

export function PlanningPeriodArchivedEditBanner({
  periodLabel,
  onExitEdit,
}: {
  periodLabel: string;
  onExitEdit: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-ag-accent/30 bg-ag-accent/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p className="text-sm text-ag-text">
        Você está editando o planejamento arquivado <strong>{periodLabel}</strong>. O planejamento ativo do
        cliente não foi alterado.
      </p>
      <Button variant="secondary" size="sm" onClick={onExitEdit} className="shrink-0">
        <X className="h-3.5 w-3.5" />
        Encerrar edição
      </Button>
    </div>
  );
}
