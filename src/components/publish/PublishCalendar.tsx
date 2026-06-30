"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import { PublishCalendarEventPill } from "./PublishCalendarEventPill";
import {
  bucketByCalendarDate,
  calendarDateKey,
  combineDateAndTime,
  defaultTimeForDrop,
  detectPlanningGaps,
  getMonthWeeks,
  getWeekDays,
  itemsForCalendar,
  MONTH_PREVIEW_MAX,
  PUBLISH_DRAG_MIME,
  WEEK_PREVIEW_MAX,
  type CalendarViewMode,
} from "./publishCalendarUtils";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function DayCell({
  date,
  items,
  allItems,
  draftSchedules,
  isToday,
  isGap,
  isWeekend,
  onDrop,
  onItemClick,
  onEmptyClick,
  onOpenDayDetail,
  density,
  previewMax,
}: {
  date: Date;
  items: PublishQueueItem[];
  allItems: PublishQueueItem[];
  draftSchedules: Record<string, string>;
  isToday: boolean;
  isGap?: boolean;
  isWeekend?: boolean;
  onDrop: (dateKey: string, postId: string) => void;
  onItemClick: (item: PublishQueueItem) => void;
  onEmptyClick: (dateKey: string) => void;
  onOpenDayDetail?: (dateKey: string) => void;
  density: "month" | "week";
  previewMax: number;
}) {
  const [dragOver, setDragOver] = useState(false);
  const dateKey = calendarDateKey(date);
  const dayNum = date.getDate();
  const preview = items.slice(0, previewMax);
  const overflowCount = allItems.length - preview.length;

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(PUBLISH_DRAG_MIME)) {
      e.preventDefault();
      setDragOver(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const postId = e.dataTransfer.getData(PUBLISH_DRAG_MIME);
    if (postId) onDrop(dateKey, postId);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "rounded-xl border flex flex-col transition-all duration-200 group/day",
        density === "month" ? "p-1.5 min-h-[88px]" : "p-2 min-h-[140px]",
        isToday && "border-ag-accent/60 bg-ag-accent-soft/25 shadow-[var(--ag-shadow)]",
        isWeekend && !isToday && "bg-ag-surface-2/30",
        isGap && allItems.length === 0 && "border-dashed border-ag-warning/40 bg-ag-warning/5",
        dragOver && "border-ag-accent bg-ag-accent-soft/40 ring-2 ring-ag-accent/25 scale-[1.01]",
        !isToday && !dragOver && !(isGap && allItems.length === 0) && "border-ag-border/50 bg-ag-surface-1 hover:border-ag-border hover:shadow-[var(--ag-shadow)]"
      )}
    >
      <div className="flex items-center justify-between mb-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onOpenDayDetail?.(dateKey)}
          className={cn(
            "text-xs font-semibold transition-colors ag-focus-ring",
            isToday
              ? "h-6 w-6 flex items-center justify-center rounded-full bg-ag-accent text-ag-accent-fg text-[11px]"
              : "rounded px-1 -mx-1 hover:bg-ag-surface-2 text-ag-muted",
            onOpenDayDetail && "cursor-pointer"
          )}
        >
          {dayNum}
        </button>
        {allItems.length > 1 && (
          <span className="text-[9px] font-medium text-ag-muted tabular-nums">
            · {allItems.length}
          </span>
        )}
        {allItems.length === 0 && (
          <button
            type="button"
            onClick={() => onEmptyClick(dateKey)}
            className="p-0.5 rounded text-ag-muted hover:text-ag-accent opacity-0 group-hover/day:opacity-100 hover:opacity-100 transition-opacity"
            aria-label="Adicionar neste dia"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-1 overflow-hidden min-h-0">
        {preview.map((item) => (
          <PublishCalendarEventPill
            key={item.plannedPostId}
            item={item}
            dayItems={allItems}
            draftSchedules={draftSchedules}
            density={density}
            draggable
            onClick={() => onItemClick(item)}
          />
        ))}
        {overflowCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDayDetail?.(dateKey);
            }}
            className="w-full rounded-md border border-ag-border/50 bg-ag-surface-2/60 px-1.5 py-0.5 text-[10px] font-medium text-ag-accent hover:bg-ag-accent-soft/40 transition-colors ag-focus-ring"
          >
            +{overflowCount} mais
          </button>
        )}
      </div>
    </div>
  );
}

function WeekdayHeader({ label, isWeekend }: { label: string; isWeekend?: boolean }) {
  return (
    <p
      className={cn(
        "text-[10px] font-mono uppercase tracking-wider text-center",
        isWeekend ? "text-ag-muted/70" : "text-ag-muted"
      )}
    >
      {label}
    </p>
  );
}

export function PublishCalendar({
  queue,
  draftSchedules,
  anchorDate,
  calendarMode,
  startDate,
  onDrop,
  onItemClick,
  onEmptyDayClick,
  onOpenDayDetail,
  scheduleTimezone = "America/Sao_Paulo",
}: {
  queue: PublishQueueItem[];
  draftSchedules: Record<string, string>;
  anchorDate: Date;
  calendarMode: CalendarViewMode;
  startDate: string;
  onDrop: (dateKey: string, postId: string, scheduledIso: string) => void;
  onItemClick: (item: PublishQueueItem) => void;
  onEmptyDayClick: (dateKey: string) => void;
  onOpenDayDetail?: (dateKey: string) => void;
  scheduleTimezone?: string;
}) {
  const todayKey = calendarDateKey(new Date());
  const calendarItems = useMemo(
    () => itemsForCalendar(queue, draftSchedules),
    [queue, draftSchedules]
  );
  const buckets = useMemo(
    () => bucketByCalendarDate(calendarItems, draftSchedules),
    [calendarItems, draftSchedules]
  );

  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const monthWeeks = useMemo(() => getMonthWeeks(anchorDate), [anchorDate]);

  const visibleKeys = useMemo(() => {
    const keys = new Set<string>();
    if (calendarMode === "week") {
      weekDays.forEach((d) => keys.add(calendarDateKey(d)));
    } else {
      monthWeeks
        .flat()
        .filter((d) => d.getMonth() === anchorDate.getMonth())
        .forEach((d) => keys.add(calendarDateKey(d)));
    }
    return keys;
  }, [calendarMode, weekDays, monthWeeks, anchorDate]);

  const gaps = useMemo(
    () => detectPlanningGaps(queue, startDate, visibleKeys, draftSchedules),
    [queue, startDate, visibleKeys, draftSchedules]
  );

  const handleDrop = (dateKey: string, postId: string) => {
    const existing = buckets.get(dateKey)?.length ?? 0;
    const time = defaultTimeForDrop(existing);
    onDrop(dateKey, postId, combineDateAndTime(dateKey, time, scheduleTimezone));
  };

  const previewMax = calendarMode === "week" ? WEEK_PREVIEW_MAX : MONTH_PREVIEW_MAX;
  const density = calendarMode === "week" ? "week" : "month";

  const calendarBody =
    calendarMode === "week" ? (
      <div className="grid grid-cols-7 gap-2 min-w-[640px]">
        {weekDays.map((date, i) => {
          const key = calendarDateKey(date);
          const dayItems = buckets.get(key) ?? [];
          return (
            <div key={key} className="min-w-0">
              <div className="mb-1.5 rounded-lg bg-ag-surface-2/60 py-1.5">
                <WeekdayHeader label={WEEKDAY_LABELS[i]} isWeekend={i >= 5} />
              </div>
              <DayCell
                date={date}
                items={dayItems}
                allItems={dayItems}
                draftSchedules={draftSchedules}
                isToday={key === todayKey}
                isGap={gaps.has(key)}
                isWeekend={i >= 5}
                onDrop={handleDrop}
                onItemClick={onItemClick}
                onEmptyClick={onEmptyDayClick}
                onOpenDayDetail={onOpenDayDetail}
                density={density}
                previewMax={previewMax}
              />
            </div>
          );
        })}
      </div>
    ) : (
      <div className="space-y-1.5 min-w-[640px]">
        <div className="grid grid-cols-7 gap-1.5 mb-1.5 rounded-lg bg-ag-surface-2/60 py-2">
          {WEEKDAY_LABELS.map((label, i) => (
            <WeekdayHeader key={label} label={label} isWeekend={i >= 5} />
          ))}
        </div>
        {monthWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((date, di) => {
              const key = calendarDateKey(date);
              const inMonth = date.getMonth() === anchorDate.getMonth();
              if (!inMonth) {
                return <div key={key} className="min-h-[72px]" />;
              }
              const dayItems = buckets.get(key) ?? [];
              return (
                <DayCell
                  key={key}
                  date={date}
                  items={dayItems}
                  allItems={dayItems}
                  draftSchedules={draftSchedules}
                  isToday={key === todayKey}
                  isGap={gaps.has(key)}
                  isWeekend={di >= 5}
                  onDrop={handleDrop}
                  onItemClick={onItemClick}
                  onEmptyClick={onEmptyDayClick}
                  onOpenDayDetail={onOpenDayDetail}
                  density={density}
                  previewMax={previewMax}
                />
              );
            })}
          </div>
        ))}
      </div>
    );

  return (
    <div className="ag-studio relative overflow-hidden rounded-xl border border-ag-border/70 shadow-[var(--ag-shadow)]">
      <div className="ag-studio-mesh absolute inset-0 pointer-events-none opacity-50" aria-hidden />
      <div className="relative z-10 p-4 overflow-x-auto">
        {gaps.size > 0 && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ag-warning/30 bg-ag-warning/5 px-2.5 py-1 text-[10px] text-ag-muted">
              <span className="inline-block w-2 h-2 rounded border border-dashed border-ag-warning/60" />
              Dia do planejamento sem agendamento
            </span>
          </div>
        )}
        {calendarBody}
      </div>
    </div>
  );
}
