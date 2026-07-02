import type { ContentScheduleItemStatus } from "../../types";

export const SCHEDULE_FIELD_CLASS =
  "w-full rounded-lg border border-ag-border/70 bg-ag-surface-2 px-3 py-2 text-sm text-ag-text focus:outline-none focus:ring-2 focus:ring-ag-accent/40";

export const STATUS_TONE: Record<
  ContentScheduleItemStatus,
  "neutral" | "success" | "warning" | "accent"
> = {
  draft: "neutral",
  approved: "success",
  handed_off: "warning",
  done: "accent",
};

export function statusBadgeTone(status: ContentScheduleItemStatus) {
  return STATUS_TONE[status] ?? "neutral";
}
