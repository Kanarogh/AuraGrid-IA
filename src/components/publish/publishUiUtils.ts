import type { PublishQueueItem } from "../../lib/publish/publishApi";
import {
  publishReadinessIssuesCore,
  type PublishReadinessIssue,
} from "../../lib/publish/publishReadiness";
import { buildScheduledIso } from "../../lib/publish/suggestScheduleTimes";

export type PublishFilter = "eligible" | "not_ready" | "queued" | "published" | "failed" | "all";

export function isPublishReady(item: PublishQueueItem): boolean {
  return item.status === "eligible";
}

export function filterTrayItems(
  eligible: PublishQueueItem[],
  draftSchedules: Record<string, string>
): PublishQueueItem[] {
  return eligible.filter((item) => !draftSchedules[item.plannedPostId]);
}

export function publishReadinessIssues(item: PublishQueueItem): PublishReadinessIssue[] {
  return publishReadinessIssuesCore({
    isConfirmed: item.isConfirmed,
    imageAssetId: item.imageAssetId,
    caption: item.caption,
  });
}

export function filterQueue(
  queue: PublishQueueItem[],
  filter: PublishFilter
): PublishQueueItem[] {
  if (filter === "all") return queue;
  if (filter === "eligible") return queue.filter((q) => q.status === "eligible");
  if (filter === "not_ready") return queue.filter((q) => q.status === "not_ready");
  if (filter === "queued") {
    return queue.filter((q) => q.status === "queued" || q.status === "publishing");
  }
  if (filter === "published") return queue.filter((q) => q.status === "published");
  return queue.filter((q) => q.status === "failed");
}

export function queueMetrics(queue: PublishQueueItem[]) {
  const eligible = queue.filter((q) => q.status === "eligible").length;
  const notReady = queue.filter((q) => q.status === "not_ready").length;
  const scheduled = queue.filter(
    (q) => q.status === "queued" || q.status === "publishing"
  ).length;
  const published = queue.filter((q) => q.status === "published").length;
  const failed = queue.filter((q) => q.status === "failed").length;
  return { eligible, notReady, scheduled, published, failed, total: queue.length };
}

export function groupByDay(items: PublishQueueItem[]): Map<number, PublishQueueItem[]> {
  const map = new Map<number, PublishQueueItem[]>();
  for (const item of items) {
    const list = map.get(item.dayNumber) ?? [];
    list.push(item);
    map.set(item.dayNumber, list);
  }
  return map;
}

export function scheduledAtToLocalInput(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "10:00" };
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

export function localInputToIso(date: string, time: string, timezone = "America/Sao_Paulo"): string {
  return buildScheduledIso(date, time, timezone);
}
