"use client";

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
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ag-muted">
          <span>
            <strong className="text-ag-text">{summary.eligible}</strong> prontos para agendar
          </span>
          {summary.notReady > 0 && (
            <span>
              <strong className="text-ag-text">{summary.notReady}</strong> incompletos
            </span>
          )}
          <span>
            <strong className="text-ag-text">{summary.scheduled}</strong> agendados
          </span>
          <span>
            <strong className="text-ag-text">{summary.published}</strong> publicados
          </span>
          {summary.failed > 0 && (
            <span className="text-ag-danger">
              <strong>{summary.failed}</strong> com problema
            </span>
          )}
          <span className="text-ag-muted/80">
            {summary.publishedLast24h}/100 publicações (24h)
          </span>
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
          {connected ? "✓ Instagram conectado" : "○ Conectar Instagram"}
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
