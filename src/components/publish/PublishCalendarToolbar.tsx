"use client";

import type { ReactNode } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Settings2,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import type { PublishQueueSummary } from "../../lib/publish/publishApi";
import type { CalendarViewMode, HubViewMode } from "./publishCalendarUtils";
import { formatMonthYear, formatWeekRange, getWeekDays } from "./publishCalendarUtils";

function SummaryChip({
  children,
  tone,
  interactive,
}: {
  children: ReactNode;
  tone: "accent" | "warning" | "neutral" | "success" | "danger" | "muted";
  interactive?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        tone === "accent" && "border-ag-accent/30 bg-ag-accent-soft/40 text-ag-accent",
        tone === "warning" && "border-ag-warning/30 bg-ag-warning/10 text-ag-warning",
        tone === "neutral" && "border-ag-border bg-ag-surface-2/60 text-ag-muted",
        tone === "success" && "border-ag-success/30 bg-ag-success/10 text-ag-success",
        tone === "danger" && "border-ag-danger/30 bg-ag-danger/10 text-ag-danger",
        tone === "muted" && "border-ag-border/50 bg-transparent text-ag-muted/80",
        interactive && "hover:bg-ag-warning/15 cursor-pointer"
      )}
    >
      {children}
    </span>
  );
}

export function PublishCalendarToolbar({
  anchorDate,
  calendarMode,
  hubView,
  summary,
  onAnchorChange,
  onCalendarModeChange,
  onHubViewChange,
  onToday,
  showFeedPreview,
  onToggleFeedPreview,
  onIncompletosClick,
}: {
  anchorDate: Date;
  calendarMode: CalendarViewMode;
  hubView: HubViewMode;
  summary: PublishQueueSummary | null;
  onAnchorChange: (delta: -1 | 1) => void;
  onCalendarModeChange: (mode: CalendarViewMode) => void;
  onHubViewChange: (view: HubViewMode) => void;
  onToday: () => void;
  showFeedPreview?: boolean;
  onToggleFeedPreview?: () => void;
  onIncompletosClick?: () => void;
}) {
  const weekDays = getWeekDays(anchorDate);
  const periodLabel =
    calendarMode === "week" ? formatWeekRange(weekDays) : formatMonthYear(anchorDate);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 w-full">
        {hubView === "calendar" && (
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <Button type="button" variant="ghost" size="sm" onClick={() => onAnchorChange(-1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-ag-text min-w-[140px] text-center capitalize">
              {periodLabel}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onAnchorChange(1)} aria-label="Próximo">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onToday}>
              Hoje
            </Button>
            <div className="flex rounded-xl border border-ag-border p-0.5">
              {(["week", "month"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onCalendarModeChange(mode)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                    calendarMode === mode
                      ? "bg-ag-accent-soft text-ag-accent"
                      : "text-ag-muted hover:text-ag-text"
                  )}
                >
                  {mode === "week" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
            {onToggleFeedPreview && (
              <Button
                type="button"
                variant={showFeedPreview ? "secondary" : "ghost"}
                size="sm"
                onClick={onToggleFeedPreview}
                className="inline-flex"
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                {showFeedPreview ? "Ocultar feed" : "Ver feed"}
              </Button>
            )}
          </div>
        )}

        <div className="flex shrink-0 ml-auto">
          <div className="flex rounded-xl border border-ag-border p-0.5">
            {(
              [
                { id: "calendar" as const, label: "Calendário", icon: Calendar },
                { id: "list" as const, label: "Lista", icon: List },
                { id: "settings" as const, label: "Config", icon: Settings2 },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onHubViewChange(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                  hubView === id ? "bg-ag-surface-1 text-ag-text shadow-sm" : "text-ag-muted hover:text-ag-text"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {summary && (
        <div className="flex flex-wrap gap-2">
          <SummaryChip tone="accent">
            <strong>{summary.eligible}</strong> prontos
          </SummaryChip>
          {summary.notReady > 0 && (
            <button
              type="button"
              onClick={() => {
                if (onIncompletosClick) {
                  onIncompletosClick();
                } else {
                  onHubViewChange("list");
                }
              }}
              className="ag-focus-ring rounded-full"
              title="Ver incompletos e o que falta em cada post"
            >
              <SummaryChip tone="warning" interactive>
                <strong>{summary.notReady}</strong> incompletos
              </SummaryChip>
            </button>
          )}
          <SummaryChip tone="neutral">
            <strong>{summary.scheduled}</strong> agendados
          </SummaryChip>
          <SummaryChip tone="success">
            <strong>{summary.published}</strong> publicados
          </SummaryChip>
          {summary.failed > 0 && (
            <SummaryChip tone="danger">
              <strong>{summary.failed}</strong> com problema
            </SummaryChip>
          )}
          <SummaryChip tone="muted">
            {summary.publishedLast24h}/100 (24h)
          </SummaryChip>
        </div>
      )}
    </div>
  );
}

export function PublishStatusBanner({
  connected,
  eligible,
  onDismissChecklist,
  showChecklist,
}: {
  connected: boolean;
  eligible: number;
  onDismissChecklist?: () => void;
  showChecklist?: boolean;
}) {
  if (!showChecklist) return null;
  return (
    <div className="rounded-xl border border-ag-border/60 bg-ag-surface-2/50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-ag-muted">
        <span className={connected ? "text-ag-success" : "text-ag-warning"}>
          {connected ? "✓ Redes conectadas" : "○ Conectar redes sociais"}
        </span>
        <span>{eligible > 0 ? `✓ ${eligible} posts prontos` : "○ Aprovar posts no planejamento"}</span>
      </div>
      {onDismissChecklist && (
        <button type="button" className="text-ag-muted hover:text-ag-text" onClick={onDismissChecklist}>
          Ocultar
        </button>
      )}
    </div>
  );
}
