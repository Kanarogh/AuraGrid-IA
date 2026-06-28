"use client";

import { cn } from "../../lib/cn";
import { PostFeedImage } from "../posts/PostFeedImage";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import {
  formatTimeLabel,
  publishPostSlotLabel,
  PUBLISH_DRAG_MIME,
  resolveItemSchedule,
  statusDotClass,
  statusPillClass,
} from "./publishCalendarUtils";

export function PublishCalendarEventPill({
  item,
  dayItems,
  draftSchedules,
  density = "month",
  draggable,
  onClick,
}: {
  item: PublishQueueItem;
  dayItems: PublishQueueItem[];
  draftSchedules: Record<string, string>;
  density?: "month" | "week";
  draggable?: boolean;
  onClick?: () => void;
}) {
  const iso = resolveItemSchedule(item, draftSchedules);
  const timeLabel = iso ? formatTimeLabel(iso) : null;
  const hasDraft = Boolean(draftSchedules[item.plannedPostId]);
  const label = publishPostSlotLabel(item, dayItems);
  const isWeek = density === "week";

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData(PUBLISH_DRAG_MIME, item.plannedPostId);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "group/pill flex items-center gap-1.5 w-full min-w-0 rounded-md border-l-[3px] border border-ag-border/40 transition-all",
        isWeek ? "px-2 py-1.5" : "px-1.5 py-1",
        statusPillClass(item.status, hasDraft),
        draggable && "cursor-grab active:cursor-grabbing",
        onClick && "cursor-pointer ag-focus-ring hover:shadow-sm hover:border-ag-accent/30"
      )}
    >
      <div
        className={cn(
          "relative shrink-0 rounded overflow-hidden bg-ag-surface-3",
          isWeek ? "h-7 w-7" : "h-6 w-6"
        )}
      >
        {item.imageUrl ? (
          <PostFeedImage src={item.imageUrl} className="absolute inset-0" priority={false} />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[8px] text-ag-muted">
            ·
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col leading-tight">
        <div className="flex items-center gap-1 min-w-0">
          {timeLabel && (
            <span className="text-[10px] font-semibold tabular-nums text-ag-text shrink-0">
              {timeLabel}
            </span>
          )}
          <span className="text-[9px] text-ag-muted truncate">{label}</span>
        </div>
        {isWeek && item.caption && (
          <p className="text-[9px] text-ag-muted truncate mt-0.5">{item.caption}</p>
        )}
      </div>

      <span
        className={cn(
          "shrink-0 h-1.5 w-1.5 rounded-full",
          statusDotClass(item.status, hasDraft)
        )}
        aria-hidden
      />
    </div>
  );
}
