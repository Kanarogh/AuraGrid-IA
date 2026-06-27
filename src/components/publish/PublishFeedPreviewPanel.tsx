"use client";

import { useMemo, useState } from "react";
import { Grid3X3 } from "lucide-react";
import type { CanvaGridPage, PlannedPost } from "../../types";
import { InstagramProfileMockup } from "../feed/InstagramProfileMockup";
import { cn } from "../../lib/cn";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import { buildScheduleOverlay, formatTimeLabel, queueItemToPlannedPost } from "./publishCalendarUtils";

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
      if (item.imageUrl || item.imageAssetId) {
        byId.set(item.plannedPostId, queueItemToPlannedPost(item));
      }
    }
    return [...byId.values()].filter((p) => p.image);
  }, [posts, queue, includeScheduled]);

  const activeId = mergedPosts[0]?.id ?? "";

  return (
    <div
      className={cn(
        "rounded-2xl border border-ag-border bg-ag-surface-2/30 overflow-hidden",
        mobileSheet && "max-h-[50vh]",
        className
      )}
    >
      <div className="px-4 py-3 border-b border-ag-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-4 w-4 text-ag-accent" />
          <p className="text-sm font-semibold text-ag-text">Preview do feed</p>
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-ag-muted cursor-pointer">
          <input
            type="checkbox"
            checked={includeScheduled}
            onChange={(e) => setIncludeScheduled(e.target.checked)}
            className="accent-ag-accent"
          />
          Incluir agendados
        </label>
      </div>
      <div className="overflow-auto p-2 scale-[0.85] origin-top max-h-[520px]">
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
      {overlay.size > 0 && (
        <div className="px-4 py-2 border-t border-ag-border text-[10px] text-ag-muted space-y-1 max-h-24 overflow-auto">
          {[...overlay.entries()].slice(0, 5).map(([id, meta]) => (
            <p key={id}>
              <span className="text-ag-accent">{formatTimeLabel(meta.scheduledAt)}</span>
              {" · "}
              {meta.status === "published" ? "No ar" : meta.status === "queued" ? "Agendado" : meta.status}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
