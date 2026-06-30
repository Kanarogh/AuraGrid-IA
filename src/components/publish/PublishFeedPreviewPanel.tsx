"use client";

import { useMemo, useState } from "react";
import { EyeOff, Grid3X3 } from "lucide-react";
import type { CanvaGridPage, PlannedPost } from "../../types";
import { InstagramProfileMockup } from "../feed/InstagramProfileMockup";
import { cn } from "../../lib/cn";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import {
  buildScheduleOverlay,
  formatTimeLabel,
  queueItemToPlannedPost,
  resolveItemSchedule,
  resolvePublishCaption,
} from "./publishCalendarUtils";

function statusLabel(status: PublishQueueItem["status"]) {
  if (status === "published") return "No ar";
  if (status === "queued" || status === "publishing") return "Agendado";
  if (status === "failed") return "Falhou";
  if (status === "cancelled") return "Cancelado";
  return "Rascunho";
}

export function PublishFeedPreviewPanel({
  posts,
  queue,
  draftSchedules,
  canvaPages,
  canvaGridReversed,
  displayName,
  instagramHandle,
  className,
  mobileSheet,
  onHide,
}: {
  posts: PlannedPost[];
  queue: PublishQueueItem[];
  draftSchedules: Record<string, string>;
  canvaPages?: CanvaGridPage[];
  canvaGridReversed?: boolean;
  displayName: string;
  instagramHandle: string;
  className?: string;
  mobileSheet?: boolean;
  onHide?: () => void;
}) {
  const [includeScheduled, setIncludeScheduled] = useState(true);
  const overlay = useMemo(
    () => buildScheduleOverlay(queue, draftSchedules),
    [queue, draftSchedules]
  );

  const mergedPosts = useMemo(() => {
    const byId = new Map(posts.map((p) => [p.id, { ...p }]));
    for (const item of queue) {
      if (!includeScheduled && (item.status === "queued" || item.status === "publishing")) continue;
      const caption = resolvePublishCaption(item, posts);
      if (item.imageUrl || item.imageAssetId) {
        byId.set(item.plannedPostId, { ...queueItemToPlannedPost(item), caption });
      }
    }
    return [...byId.values()].filter((p) => p.image);
  }, [posts, queue, includeScheduled]);

  const scheduledEntries = useMemo(() => {
    const seen = new Set<string>();
    const entries: Array<{
      id: string;
      dayNumber: number;
      scheduledAt: string;
      status: PublishQueueItem["status"];
      caption: string;
    }> = [];

    for (const item of queue) {
      const scheduledAt = resolveItemSchedule(item, draftSchedules);
      if (!scheduledAt) continue;
      if (
        !includeScheduled &&
        (item.status === "queued" || item.status === "publishing")
      ) {
        continue;
      }
      if (seen.has(item.plannedPostId)) continue;
      seen.add(item.plannedPostId);
      entries.push({
        id: item.plannedPostId,
        dayNumber: item.dayNumber,
        scheduledAt,
        status: draftSchedules[item.plannedPostId] ? "eligible" : item.status,
        caption: resolvePublishCaption(item, posts),
      });
    }

    return entries.sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  }, [queue, draftSchedules, posts, includeScheduled]);

  const activeId = mergedPosts[0]?.id ?? "";

  return (
    <div
      className={cn(
        "rounded-xl border border-ag-border bg-ag-surface-2/30 overflow-hidden flex flex-col min-h-0",
        mobileSheet && "max-h-[70vh]",
        className
      )}
    >
      <div className="shrink-0 px-4 py-3 border-b border-ag-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Grid3X3 className="h-4 w-4 text-ag-accent shrink-0" />
          <p className="text-sm font-semibold text-ag-text truncate">Preview do feed</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 text-[10px] text-ag-muted cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeScheduled}
              onChange={(e) => setIncludeScheduled(e.target.checked)}
              className="accent-ag-accent"
            />
            Incluir agendados
          </label>
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="inline-flex items-center gap-1 rounded-lg border border-ag-border bg-ag-surface-1 px-2 py-1 text-[10px] font-medium text-ag-muted hover:text-ag-text ag-focus-ring"
              title="Ocultar preview do feed"
            >
              <EyeOff className="h-3 w-3" />
              Ocultar
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 overflow-auto p-2 scale-[0.85] origin-top max-h-[360px]">
        <InstagramProfileMockup
          posts={mergedPosts}
          canvaPages={canvaPages}
          canvaGridReversed={canvaGridReversed}
          displayName={displayName}
          username={instagramHandle}
          activePreviewId={activeId}
          swapSourceId=""
          onSelectPost={() => {}}
          onSwapDays={() => {}}
          scheduleOverlay={overlay}
        />
      </div>

      <div className="flex-1 min-h-0 border-t border-ag-border flex flex-col">
        <div className="shrink-0 px-4 py-2 border-b border-ag-border/60">
          <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted">
            Legendas agendadas
          </p>
        </div>
        {scheduledEntries.length === 0 ? (
          <p className="px-4 py-3 text-xs text-ag-muted italic">
            Nenhum post com horário definido ainda.
          </p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-3 max-h-[280px]">
            {scheduledEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-lg border border-ag-border/70 bg-ag-surface-1 p-2.5 space-y-1.5"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                  <span className="font-semibold text-ag-text">D{entry.dayNumber}</span>
                  <span className="text-ag-accent font-medium">
                    {formatTimeLabel(entry.scheduledAt)}
                  </span>
                  <span className="text-ag-muted">· {statusLabel(entry.status)}</span>
                </div>
                {entry.caption ? (
                  <p className="text-xs leading-relaxed text-ag-text whitespace-pre-wrap break-words">
                    {entry.caption}
                  </p>
                ) : (
                  <p className="text-xs text-ag-muted italic">Sem legenda</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
