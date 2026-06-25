"use client";

import { CalendarRange, ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlanningPeriod } from "../../lib/planningConstants";
import { catalogReadyForTextMatch } from "../../lib/catalogEnrichment";
import { useClientWorkspace } from "../../context/ClientWorkspaceContext";
import { useAppNavigation } from "../../lib/appRouting";
import { confirmDialog } from "../../lib/confirmDialog";
import {
  buildDisableReferencesConfirmMessage,
  resolveUsesReferences,
} from "../../lib/referenceWorkflow";
import { cn } from "../../lib/cn";
import { usePlanningPeriodModal } from "./planningPeriodModalContext";

function statusLabel(status: PlanningPeriod["status"]) {
  if (status === "active") return "Ativo";
  if (status === "archived") return "Arquivado";
  return "Rascunho";
}

function formatStartDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function shortPeriodLabel(label: string, startDate: string): string {
  const monthPart = label.split(" de ")[0]?.trim();
  if (monthPart && monthPart.length <= 8) return monthPart;
  const [, m, d] = startDate.split("-");
  if (m && d) return `${d}/${m}`;
  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
}

export function PlanningPeriodSidebarPanel({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "popover";
}) {
  const { openNewPlanningPeriod } = usePlanningPeriodModal();
  const { navigateClient } = useAppNavigation();
  const {
    hasActiveClient,
    activeClient,
    workspace,
    setPeriodUsesReferences,
  } = useClientWorkspace();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const planningPeriods = workspace.planningPeriods;
  const activePlanningPeriodId = workspace.activePlanningPeriodId;
  const isReadOnly = workspace.isReadOnly ?? false;
  const periodEditMode = workspace.periodEditMode ?? "active";
  const usesReferences = workspace.usesReferences !== false;
  const catalog = workspace.catalog ?? [];

  const active =
    planningPeriods.find((p) => p.id === activePlanningPeriodId) ?? planningPeriods[0];
  const periodUsesReferencesOverride = active?.usesReferences ?? null;
  const referenceCatalog = catalog.filter((c) => c.isReference !== false);
  const indexedReferenceCount = referenceCatalog.filter((c) =>
    catalogReadyForTextMatch(c)
  ).length;
  const storedReferenceCount = referenceCatalog.length;

  const sorted = [...planningPeriods].sort(
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

  if (!hasActiveClient || !active) return null;

  const isPopover = variant === "popover";
  const modeLabel =
    periodEditMode === "edit_archived"
      ? "Editando arquivado"
      : periodEditMode === "view_archived" || active.status === "archived"
        ? "Somente leitura"
        : null;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative space-y-2",
        isPopover
          ? "px-3 py-2.5 border-t border-ag-border bg-ag-surface-2/40 shrink-0"
          : "mx-1 mt-2 mb-1 rounded-xl border border-ag-border/70 bg-ag-surface-2/80 p-2.5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 text-ag-muted">
          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-ag-accent" />
          <span className="text-[10px] font-bold uppercase tracking-wider truncate">
            Planejamento
          </span>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            title="Novo planejamento"
            onClick={() => openNewPlanningPeriod()}
            className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-ag-accent hover:bg-ag-accent/10 cursor-pointer shrink-0"
          >
            <Plus className="h-3 w-3" />
            Novo
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-ag-border bg-ag-surface px-2.5 py-2 text-left hover:bg-ag-surface-3 cursor-pointer"
      >
        <span className="text-sm font-semibold text-ag-text truncate">{active.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-ag-muted shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <p className="text-[10px] text-ag-muted px-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span>Início {formatStartDate(active.startDate)}</span>
        <span
          className={cn(
            "inline-flex rounded-full px-1.5 py-px text-[9px] font-semibold",
            active.status === "active"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-ag-surface text-ag-muted"
          )}
        >
          {statusLabel(active.status)}
        </span>
        {modeLabel && (
          <span className="inline-flex rounded-full px-1.5 py-px text-[9px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
            {modeLabel}
          </span>
        )}
      </p>

      {!isReadOnly && (
        <div className="space-y-1">
          <label className="text-[9px] font-bold uppercase tracking-wider text-ag-muted px-0.5">
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
              const nextOverride = v === "on" ? true : v === "off" ? false : null;
              void (async () => {
                const nextEffective = resolveUsesReferences(
                  activeClient.defaultUsesReferences,
                  nextOverride
                );
                if (usesReferences && !nextEffective && indexedReferenceCount > 0) {
                  const ok = await confirmDialog({
                    message: buildDisableReferencesConfirmMessage(indexedReferenceCount),
                    confirmLabel: "Desativar",
                  });
                  if (!ok) return;
                }
                await setPeriodUsesReferences(nextOverride);
              })();
            }}
            className="w-full rounded-lg border border-ag-border bg-ag-surface px-2 py-1.5 text-[11px] text-ag-text"
          >
            <option value="inherit">Herdar do cliente</option>
            <option value="on">Com referências</option>
            <option value="off">Sem referências</option>
          </select>
          {!usesReferences && storedReferenceCount > 0 && (
            <p className="text-[9px] text-ag-muted leading-snug px-0.5">
              {storedReferenceCount} referência{storedReferenceCount !== 1 ? "s" : ""} guardada
              {storedReferenceCount !== 1 ? "s" : ""} e oculta
              {storedReferenceCount !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      )}

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 right-0 z-[90] rounded-xl border border-ag-border bg-ag-surface shadow-lg overflow-hidden",
            isPopover ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          <ul className="max-h-52 overflow-y-auto py-1 ag-scrollbar-thin">
            {sorted.map((period) => {
              const selected = period.id === activePlanningPeriodId;
              return (
                <li key={period.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      void navigateClient({ periodId: period.id }, { replace: true, skipDirtyGuard: true });
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2.5 text-left hover:bg-ag-surface-2 transition-colors",
                      selected && "bg-ag-accent-soft/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-xs text-ag-text truncate">
                        {period.label}
                      </span>
                      <span className="text-[9px] font-semibold text-ag-muted shrink-0">
                        {statusLabel(period.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-ag-muted mt-0.5">
                      {formatStartDate(period.startDate)}
                      {typeof period.filledPostsCount === "number" &&
                        period.filledPostsCount > 0 && (
                          <span className="ml-1.5">· {period.filledPostsCount} posts</span>
                        )}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
          {!isReadOnly && (
            <div className="border-t border-ag-border/60 p-1.5">
              <button
                type="button"
                onClick={() => {
                  openNewPlanningPeriod();
                  setOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-semibold text-ag-accent hover:bg-ag-accent/10 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo planejamento
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
