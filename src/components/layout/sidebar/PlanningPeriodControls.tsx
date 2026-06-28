"use client";

import { CalendarRange, ChevronDown, Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { isCatalogItemIndexed } from "../../../lib/catalog";
import { useClientWorkspace } from "../../../context/ClientWorkspaceContext";
import { useAppNavigation } from "../../../lib/appRouting";
import { confirmDialog } from "../../../lib/confirmDialog";
import { recalculatePostDates } from "../../../lib/dates";
import {
  buildDisableReferencesConfirmMessage,
  resolveUsesReferences,
} from "../../../lib/referenceWorkflow";
import { cn } from "../../../lib/cn";
import { usePlanningPeriodModal } from "../planningPeriodModalContext";
import { FloatingPopover } from "../../ui/FloatingPopover";
import { Input } from "../../ui/Input";
import { formatStartDate, statusLabel } from "./planningPeriodUtils";

export function PlanningPeriodControls({ compact = false }: { compact?: boolean }) {
  const { openNewPlanningPeriod } = usePlanningPeriodModal();
  const { navigateRoute } = useAppNavigation();
  const {
    hasActiveClient,
    activeClient,
    workspace,
    setPeriodUsesReferences,
    setStartDate,
    setPosts,
  } = useClientWorkspace();

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
  const indexedReferenceCount = referenceCatalog.filter(isCatalogItemIndexed).length;
  const storedReferenceCount = referenceCatalog.length;

  const sorted = [...planningPeriods].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  const handleStartDateChange = useCallback(
    (newDate: string) => {
      if (!newDate || newDate === workspace.startDate) return;
      setStartDate(newDate);
      setPosts((prev) => recalculatePostDates(newDate, prev));
    },
    [setStartDate, setPosts, workspace.startDate]
  );

  if (!hasActiveClient || !active) return null;

  const modeLabel =
    periodEditMode === "edit_archived"
      ? "Editando arquivado"
      : periodEditMode === "view_archived" || active.status === "archived"
        ? "Somente leitura"
        : null;

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex items-center gap-1.5 text-ag-muted">
        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-ag-accent" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">Planejamento</span>
      </div>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-ag-border/80 bg-ag-surface px-2.5 py-2 text-left hover:bg-ag-surface-3 cursor-pointer transition-colors"
      >
        <span className="text-sm font-semibold text-ag-text truncate">{active.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-ag-muted shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <FloatingPopover
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        matchAnchorWidth
        backdrop
        role="listbox"
        className="max-h-64 flex flex-col"
      >
        <ul className="overflow-y-auto py-1 ag-scrollbar-thin flex-1 min-h-0">
          {sorted.map((period) => {
            const selected = period.id === activePlanningPeriodId;
            return (
              <li key={period.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    void navigateRoute({ periodId: period.id }, { replace: true });
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2.5 text-left hover:bg-ag-surface-2 transition-colors cursor-pointer",
                    selected && "bg-ag-accent-soft/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-xs text-ag-text truncate">{period.label}</span>
                    <span className="text-[9px] font-semibold text-ag-muted shrink-0">
                      {statusLabel(period.status)}
                    </span>
                  </div>
                  <p className="text-[10px] text-ag-muted mt-0.5">
                    {formatStartDate(period.startDate)}
                    {typeof period.filledPostsCount === "number" && period.filledPostsCount > 0 && (
                      <span className="ml-1.5">· {period.filledPostsCount} posts</span>
                    )}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
        {!isReadOnly && (
          <div className="border-t border-ag-border/60 p-1.5 shrink-0">
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
      </FloatingPopover>

      {!isReadOnly ? (
        <div className="space-y-1">
          <label
            htmlFor="sidebar-planning-start-date"
            className="text-[9px] font-semibold uppercase tracking-wider text-ag-muted"
          >
            Início do planejamento
          </label>
          <Input
            id="sidebar-planning-start-date"
            type="date"
            value={workspace.startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="rounded-lg border-ag-border bg-ag-surface px-2 py-1.5 text-[11px] font-semibold h-auto"
          />
          <p className="text-[9px] text-ag-muted leading-snug">
            O Dia 1 começa nesta data; os demais dias são calculados em sequência.
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-ag-muted">
          Início {formatStartDate(active.startDate)}
        </p>
      )}

      <p className="text-[10px] text-ag-muted flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
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
          <label className="text-[9px] font-semibold uppercase tracking-wider text-ag-muted">
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
            <p className="text-[9px] text-ag-muted leading-snug">
              {storedReferenceCount} referência{storedReferenceCount !== 1 ? "s" : ""} guardada
              {storedReferenceCount !== 1 ? "s" : ""} e oculta
              {storedReferenceCount !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      )}

      {!isReadOnly && !compact && (
        <button
          type="button"
          onClick={() => openNewPlanningPeriod()}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-ag-border py-2 text-[11px] font-semibold text-ag-accent hover:bg-ag-accent/10 cursor-pointer transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo planejamento
        </button>
      )}
    </div>
  );
}
