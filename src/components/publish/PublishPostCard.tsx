"use client";

import { cn } from "../../lib/cn";
import { PostFeedImage } from "../posts/PostFeedImage";
import { Badge } from "../ui/Badge";
import { PUBLISH_STATUS_LABELS, type PublishQueueItem } from "../../lib/publish/publishApi";
import { formatTimeLabel, PUBLISH_DRAG_MIME, resolveItemSchedule, statusBorderClass } from "./publishCalendarUtils";

function statusTone(status: PublishQueueItem["status"]) {
  if (status === "published") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "queued" || status === "publishing") return "accent" as const;
  return "neutral" as const;
}

export function PublishPostCard({
  item,
  draftSchedules,
  compact,
  draggable,
  selected,
  onClick,
  showStatus = true,
}: {
  item: PublishQueueItem;
  draftSchedules?: Record<string, string>;
  compact?: boolean;
  draggable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  showStatus?: boolean;
}) {
  const iso = draftSchedules ? resolveItemSchedule(item, draftSchedules) : item.scheduledAt;
  const timeLabel = iso ? formatTimeLabel(iso) : null;
  const hasDraft = Boolean(draftSchedules?.[item.plannedPostId]);
  const statusBorder = statusBorderClass(item.status, hasDraft);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(PUBLISH_DRAG_MIME, item.plannedPostId);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-xl border bg-ag-surface-1 transition-all",
        compact ? "p-1.5 min-w-[88px]" : "p-2",
        statusBorder,
        draggable && "cursor-grab active:cursor-grabbing",
        onClick && "cursor-pointer hover:border-ag-accent/50 hover:shadow-sm ag-focus-ring",
        selected ? "border-ag-accent ring-2 ring-ag-accent/30" : "border-ag-border"
      )}
    >
      <div
        className={cn(
          "relative rounded-lg overflow-hidden bg-ag-surface-3",
          compact ? "h-14 w-14 mx-auto" : "h-16 w-full aspect-[4/5] max-h-20"
        )}
      >
        {item.imageUrl ? (
          <PostFeedImage src={item.imageUrl} className="absolute inset-0" priority={false} />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[10px] text-ag-muted">
            Sem foto
          </div>
        )}
        {timeLabel && (
          <span className="absolute bottom-0 inset-x-0 bg-black/65 text-[9px] text-white text-center py-0.5 font-medium">
            {timeLabel}
          </span>
        )}
      </div>
      <div className={cn("mt-1.5 space-y-1", compact && "text-center")}>
        <p className={cn("font-semibold text-ag-text", compact ? "text-[10px]" : "text-xs")}>
          D{item.dayNumber}
        </p>
        {showStatus && compact && (
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full mx-auto",
              item.status === "published" && "bg-emerald-500",
              item.status === "failed" && "bg-red-500",
              item.status === "publishing" && "bg-violet-500 animate-pulse",
              item.status === "queued" && "bg-ag-accent",
              item.status === "eligible" && hasDraft && "bg-amber-500"
            )}
            aria-hidden
          />
        )}
        {showStatus && !compact && (
          <Badge tone={statusTone(item.status)} className="text-[10px]">
            {PUBLISH_STATUS_LABELS[item.status]}
          </Badge>
        )}
      </div>
    </div>
  );
}
