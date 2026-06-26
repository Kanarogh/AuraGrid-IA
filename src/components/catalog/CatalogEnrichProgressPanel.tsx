"use client";

import { Loader2, Sparkles, Square } from "lucide-react";
import { cn } from "../../lib/cn";
import type { CatalogEnrichProgress } from "../../lib/api/workspaceApi";
import { enrichBatchPercent, enrichStepLabel } from "../../lib/enrichProgressStages";
import { useSmoothEnrichPercent } from "../../hooks/useSmoothEnrichPercent";

export function CatalogEnrichProgressPanel({
  progress,
  isEnriching,
  onStop,
}: {
  progress: CatalogEnrichProgress | null;
  isEnriching: boolean;
  onStop?: () => void;
}) {
  const smoothItemPercent = useSmoothEnrichPercent(isEnriching ? progress?.itemPercent : undefined, {
    phase: progress?.phase,
    active: isEnriching,
    resetKey: progress?.itemId,
  });

  if (!isEnriching) return null;

  const index = progress?.index ?? 0;
  const total = progress?.total ?? 0;
  const itemPercent = progress?.itemPercent;
  const batchPercent =
    progress && total > 0 && typeof smoothItemPercent === "number"
      ? enrichBatchPercent({ ...progress, itemPercent: smoothItemPercent })
      : progress && total > 0
        ? enrichBatchPercent(progress)
        : total > 0
          ? Math.min(100, Math.round((index / total) * 100))
          : undefined;
  const stepLabel = progress?.stepLabel ?? enrichStepLabel(progress?.phase);
  const label = progress?.label ?? "Aguardando…";
  const displayItemPercent = smoothItemPercent ?? itemPercent;

  return (
    <div
      className={cn(
        "pointer-events-auto fixed bottom-4 z-[96] w-[min(100vw-2rem,22rem)]",
        "rounded-2xl border border-ag-border bg-ag-surface-1/98 shadow-[var(--ag-shadow-lg)] backdrop-blur-md",
        "animate-ag-toast-in overflow-hidden",
        "left-4 sm:left-[calc(1rem+min(100vw-2rem,22rem)+0.75rem)]"
      )}
      role="status"
      aria-live="polite"
      aria-label="Progresso da indexação do catálogo"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ag-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-ag-accent" />
          <p className="truncate text-sm font-semibold text-ag-text">Indexando catálogo</p>
        </div>
        {onStop && (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg p-1.5 text-ag-muted transition-colors hover:bg-ag-surface-2 hover:text-ag-danger ag-focus-ring shrink-0"
            title="Parar indexação"
            aria-label="Parar indexação"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-3 px-4 py-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-ag-muted">
            <span className="font-mono tabular-nums">
              {total > 0 ? `${index} de ${total}` : "Preparando…"}
            </span>
            {batchPercent !== undefined && (
              <span className="font-mono tabular-nums">{batchPercent}%</span>
            )}
          </div>
          {total > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-ag-surface-3">
              <div
                className="h-full rounded-full bg-ag-accent"
                style={{
                  width: `${batchPercent ?? 0}%`,
                  transition: "width 80ms linear",
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-ag-accent" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ag-text" title={label}>
              {label}
            </p>
            <p className="text-[10.5px] text-ag-muted mt-0.5 truncate" title={stepLabel}>
              {stepLabel}
              {typeof displayItemPercent === "number"
                ? ` · ${Math.round(displayItemPercent)}% desta peça`
                : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
