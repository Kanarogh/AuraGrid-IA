"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import { PublishPostCard } from "./PublishPostCard";
import {
  bucketByCalendarDate,
  calendarDateKey,
  combineDateAndTime,
  defaultTimeForDrop,
  detectPlanningGaps,
  getMonthWeeks,
  getWeekDays,
  itemsForCalendar,
  PUBLISH_DRAG_MIME,
  type CalendarViewMode,
} from "./publishCalendarUtils";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_PREVIEW_MAX = 3;

function DayCell({
  date,
  items,
  allItems,
  draftSchedules,
  isToday,
  isGap,
  onDrop,
  onItemClick,
  onEmptyClick,
  onExpandDay,
  compact,
  expanded,
}: {
  date: Date;
  items: PublishQueueItem[];
  allItems?: PublishQueueItem[];
  draftSchedules: Record<string, string>;
  isToday: boolean;
  isGap?: boolean;
  onDrop: (dateKey: string, postId: string) => void;
  onItemClick: (item: PublishQueueItem) => void;
  onEmptyClick: (dateKey: string) => void;
  onExpandDay?: (dateKey: string) => void;
  compact?: boolean;
  expanded?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const dateKey = calendarDateKey(date);
  const dayNum = date.getDate();
  const displayItems = expanded ? (allItems ?? items) : items;
  const overflow = !expanded && (allItems?.length ?? items.length) > items.length;

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
        "rounded-xl border min-h-[120px] flex flex-col transition-colors group/day",
        compact ? "p-1.5 min-h-[80px]" : "p-2 min-h-[140px]",
        isToday && "border-ag-accent/50 bg-ag-accent-soft/20",
        isGap && !displayItems.length && "border-dashed border-ag-warning/40 bg-ag-warning/5",
        dragOver && "border-ag-accent bg-ag-accent-soft/40 ring-2 ring-ag-accent/20",
        !isToday && !dragOver && !isGap && "border-ag-border/60 bg-ag-surface-1/50"
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          onClick={() => onExpandDay?.(dateKey)}
          className={cn(
            "text-xs font-semibold rounded px-1 -mx-1 hover:bg-ag-surface-2",
            isToday ? "text-ag-accent" : "text-ag-muted",
            onExpandDay && "cursor-pointer"
          )}
        >
          {dayNum}
        </button>
        {displayItems.length === 0 && (
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
      <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px]">
        {displayItems.map((item) => (
          <PublishPostCard
            key={item.plannedPostId}
            item={item}
            draftSchedules={draftSchedules}
            compact
            draggable
            onClick={() => onItemClick(item)}
            showStatus
          />
        ))}
        {overflow && (
          <button
            type="button"
            onClick={() => onExpandDay?.(dateKey)}
            className="w-full text-[10px] font-medium text-ag-accent hover:underline py-1"
          >
            +{(allItems?.length ?? 0) - items.length} mais
          </button>
        )}
      </div>
    </div>
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
  onExpandDay,
  expandedDayKey,
}: {
  queue: PublishQueueItem[];
  draftSchedules: Record<string, string>;
  anchorDate: Date;
  calendarMode: CalendarViewMode;
  startDate: string;
  onDrop: (dateKey: string, postId: string, scheduledIso: string) => void;
  onItemClick: (item: PublishQueueItem) => void;
  onEmptyDayClick: (dateKey: string) => void;
  onExpandDay?: (dateKey: string) => void;
  expandedDayKey?: string | null;
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
    onDrop(dateKey, postId, combineDateAndTime(dateKey, time));
  };

  const calendarBody =
    calendarMode === "week" ? (
      <div className="grid grid-cols-7 gap-2 min-w-[640px]">
        {weekDays.map((date, i) => {
          const key = calendarDateKey(date);
          return (
            <div key={key} className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-ag-muted text-center mb-1.5">
                {WEEKDAY_LABELS[i]}
              </p>
              <DayCell
                date={date}
                items={buckets.get(key) ?? []}
                draftSchedules={draftSchedules}
                isToday={key === todayKey}
                isGap={gaps.has(key)}
                onDrop={handleDrop}
                onItemClick={onItemClick}
                onEmptyClick={onEmptyDayClick}
                onExpandDay={onExpandDay}
                expanded={expandedDayKey === key}
              />
            </div>
          );
        })}
      </div>
    ) : (
      <div className="space-y-1 min-w-[640px]">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_LABELS.map((label) => (
            <p key={label} className="text-[10px] font-mono uppercase text-ag-muted text-center">
              {label}
            </p>
          ))}
        </div>
        {monthWeeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((date) => {
              const key = calendarDateKey(date);
              const inMonth = date.getMonth() === anchorDate.getMonth();
              if (!inMonth) {
                return <div key={key} className="min-h-[72px]" />;
              }
              const dayItems = buckets.get(key) ?? [];
              const preview = dayItems.slice(0, MONTH_PREVIEW_MAX);
              return (
                <DayCell
                  key={key}
                  date={date}
                  items={preview}
                  allItems={dayItems}
                  draftSchedules={draftSchedules}
                  isToday={key === todayKey}
                  isGap={gaps.has(key)}
                  onDrop={handleDrop}
                  onItemClick={onItemClick}
                  onEmptyClick={onEmptyDayClick}
                  onExpandDay={onExpandDay}
                  compact
                  expanded={expandedDayKey === key}
                />
              );
            })}
          </div>
        ))}
      </div>
    );

  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-1">
      {isGapLegend(gaps) && (
        <p className="text-[10px] text-ag-muted mb-2">
          <span className="inline-block w-2 h-2 rounded border border-dashed border-ag-warning/60 mr-1 align-middle" />
          Dia do planejamento sem agendamento
        </p>
      )}
      {calendarBody}
    </div>
  );
}

function isGapLegend(gaps: Set<string>) {
  return gaps.size > 0;
}
