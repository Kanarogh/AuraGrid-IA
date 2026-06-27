import type { PublishQueueItem } from "../../lib/publish/publishApi";

export type PublishFilter = "eligible" | "queued" | "published" | "failed" | "all";

export function filterQueue(
  queue: PublishQueueItem[],
  filter: PublishFilter
): PublishQueueItem[] {
  if (filter === "all") return queue;
  if (filter === "eligible") {
    return queue.filter(
      (q) =>
        q.status === "eligible" &&
        q.isConfirmed &&
        !!q.imageAssetId &&
        !!q.caption.trim()
    );
  }
  if (filter === "queued") {
    return queue.filter((q) => q.status === "queued" || q.status === "publishing");
  }
  if (filter === "published") return queue.filter((q) => q.status === "published");
  return queue.filter((q) => q.status === "failed");
}

export function queueMetrics(queue: PublishQueueItem[]) {
  const eligible = queue.filter(
    (q) =>
      q.status === "eligible" && q.isConfirmed && q.imageAssetId && q.caption.trim()
  ).length;
  const scheduled = queue.filter(
    (q) => q.status === "queued" || q.status === "publishing"
  ).length;
  const published = queue.filter((q) => q.status === "published").length;
  const failed = queue.filter((q) => q.status === "failed").length;
  return { eligible, scheduled, published, failed };
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

export function localInputToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}
