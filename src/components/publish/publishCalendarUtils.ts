import type { PlannedPost } from "../../types";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import { buildScheduledIso, calendarDateForPost } from "../../lib/publish/suggestScheduleTimes";
import { filterQueue } from "./publishUiUtils";

export const PUBLISH_DRAG_MIME = "application/x-ag-publish-post";

export const MONTH_PREVIEW_MAX = 2;
export const WEEK_PREVIEW_MAX = 4;

export type CalendarViewMode = "week" | "month";
export type HubViewMode = "calendar" | "list" | "settings";

export function calendarDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseCalendarDateKey(key: string): Date {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function resolveItemSchedule(
  item: PublishQueueItem,
  draftSchedules: Record<string, string>
): string | null {
  return draftSchedules[item.plannedPostId] ?? item.scheduledAt ?? null;
}

export function resolvePublishCaption(item: PublishQueueItem, posts: PlannedPost[]): string {
  const fromQueue = item.caption?.trim();
  if (fromQueue) return fromQueue;
  const post = posts.find((p) => p.id === item.plannedPostId);
  return post?.caption?.trim() ?? "";
}

export function scheduleToDateKey(
  item: PublishQueueItem,
  draftSchedules: Record<string, string>
): string | null {
  const iso = resolveItemSchedule(item, draftSchedules);
  if (!iso) return null;
  return isoToCalendarDateKey(iso);
}

/** Extrai YYYY-MM-DD do ISO de agendamento (preserva dia escolhido no calendário). */
export function isoToCalendarDateKey(iso: string): string {
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return calendarDateKey(new Date(iso));
}

export function itemsForCalendar(queue: PublishQueueItem[], draftSchedules: Record<string, string>) {
  return queue.filter((item) => {
    if (item.status === "eligible") {
      return !!resolveItemSchedule(item, draftSchedules);
    }
    return ["queued", "publishing", "published", "failed"].includes(item.status);
  });
}

export function bucketByCalendarDate(
  items: PublishQueueItem[],
  draftSchedules: Record<string, string>
): Map<string, PublishQueueItem[]> {
  const map = new Map<string, PublishQueueItem[]>();
  for (const item of items) {
    const key = scheduleToDateKey(item, draftSchedules);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => {
      const ta = resolveItemSchedule(a, draftSchedules);
      const tb = resolveItemSchedule(b, draftSchedules);
      if (!ta || !tb) return a.dayNumber - b.dayNumber;
      return new Date(ta).getTime() - new Date(tb).getTime();
    });
  }
  return map;
}

export function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function getMonthWeeks(anchor: Date): Date[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const weeks: Date[][] = [];
  let cursor = startOfWeek(first);
  while (cursor <= last || weeks.length < 4) {
    weeks.push(getWeekDays(cursor));
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
    if (weeks.length >= 6) break;
  }
  return weeks;
}

export function formatWeekRange(days: Date[]): string {
  if (!days.length) return "";
  const start = days[0];
  const end = days[days.length - 1];
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString("pt-BR", opts)} – ${end.getDate()} ${end.toLocaleDateString("pt-BR", { month: "short" })}`;
  }
  return `${start.toLocaleDateString("pt-BR", opts)} – ${end.toLocaleDateString("pt-BR", opts)}`;
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function formatTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDayDetailTitle(dateKey: string): string {
  const d = parseCalendarDateKey(dateKey);
  const formatted = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function publishPostSlotLabel(item: PublishQueueItem, dayItems: PublishQueueItem[]): string {
  const sameDay = dayItems.filter((p) => p.dayNumber === item.dayNumber);
  if (sameDay.length <= 1) return `D${item.dayNumber}`;
  const slotIndex = sameDay.findIndex((p) => p.plannedPostId === item.plannedPostId);
  return `D${item.dayNumber} · Post ${slotIndex + 1}`;
}

export function combineDateAndTime(
  dateKey: string,
  time: string,
  timezone = "America/Sao_Paulo"
): string {
  return buildScheduledIso(dateKey, time, timezone);
}

export function validateScheduledTime(
  iso: string,
  leadMinutes: number
): { ok: true } | { ok: false; reason: string } {
  const scheduledMs = new Date(iso).getTime();
  const minMs = Date.now() + leadMinutes * 60_000;
  if (scheduledMs < minMs) {
    return {
      ok: false,
      reason: `O horário deve ser pelo menos ${leadMinutes} minutos no futuro.`,
    };
  }
  return { ok: true };
}

export function wouldCreateConflict(
  iso: string,
  postId: string,
  items: PublishQueueItem[],
  draftSchedules: Record<string, string>
): boolean {
  const d = new Date(iso);
  const key = `${isoToCalendarDateKey(iso)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  for (const item of items) {
    if (item.plannedPostId === postId) continue;
    const otherIso = resolveItemSchedule(item, draftSchedules);
    if (!otherIso) continue;
    const od = new Date(otherIso);
    const otherKey = `${isoToCalendarDateKey(otherIso)}T${String(od.getHours()).padStart(2, "0")}:${String(od.getMinutes()).padStart(2, "0")}`;
    if (otherKey === key) return true;
  }
  return false;
}

export function formatScheduleToast(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function defaultTimeForDrop(existingCount: number): string {
  const slots = ["10:00", "14:00", "18:00", "09:00", "12:00", "16:00", "19:00"];
  return slots[existingCount % slots.length] ?? "10:00";
}

export function detectPlanningGaps(
  queue: PublishQueueItem[],
  startDate: string,
  visibleDateKeys: Set<string>,
  draftSchedules: Record<string, string> = {}
): Set<string> {
  const gaps = new Set<string>();
  const eligible = filterQueue(queue, "eligible");

  for (const item of eligible) {
    const planKey = calendarDateForPost(startDate, item.dayNumber);
    if (!visibleDateKeys.has(planKey)) continue;

    const hasDraft = Boolean(draftSchedules[item.plannedPostId]);
    const job = queue.find((q) => q.plannedPostId === item.plannedPostId);
    const hasActiveJob =
      job &&
      (job.status === "queued" ||
        job.status === "publishing" ||
        job.status === "published" ||
        job.status === "failed");

    if (!hasDraft && !hasActiveJob) {
      gaps.add(planKey);
    }
  }
  return gaps;
}

export function getVisibleDateKeys(anchorDate: Date, calendarMode: CalendarViewMode): Set<string> {
  const keys = new Set<string>();
  if (calendarMode === "week") {
    getWeekDays(anchorDate).forEach((d) => keys.add(calendarDateKey(d)));
  } else {
    getMonthWeeks(anchorDate)
      .flat()
      .filter((d) => d.getMonth() === anchorDate.getMonth())
      .forEach((d) => keys.add(calendarDateKey(d)));
  }
  return keys;
}

export function filterEligibleInVisibleRange(
  eligible: PublishQueueItem[],
  startDate: string,
  visibleDateKeys: Set<string>
): PublishQueueItem[] {
  return eligible.filter((item) =>
    visibleDateKeys.has(calendarDateForPost(startDate, item.dayNumber))
  );
}

export function statusBorderClass(
  status: PublishQueueItem["status"],
  hasDraft?: boolean
): string {
  if (status === "published") return "border-l-[3px] border-l-ag-success";
  if (status === "failed") return "border-l-[3px] border-l-ag-danger";
  if (status === "publishing") return "border-l-[3px] border-l-ag-accent animate-pulse";
  if (status === "queued") return "border-l-[3px] border-l-ag-accent";
  if (status === "eligible" && hasDraft) return "border-l-[3px] border-l-ag-warning";
  return "";
}

export function statusPillClass(
  status: PublishQueueItem["status"],
  hasDraft?: boolean
): string {
  if (status === "published") return "border-l-ag-success bg-ag-success/8 hover:bg-ag-success/12";
  if (status === "failed") return "border-l-ag-danger bg-ag-danger/8 hover:bg-ag-danger/12";
  if (status === "publishing") return "border-l-ag-accent bg-ag-accent/8 animate-pulse";
  if (status === "queued") return "border-l-ag-accent bg-ag-accent-soft/50 hover:bg-ag-accent-soft/70";
  if (status === "eligible" && hasDraft) return "border-l-ag-warning bg-ag-warning/8 hover:bg-ag-warning/12";
  return "border-l-ag-border bg-ag-surface-2/80 hover:bg-ag-surface-2";
}

export function statusDotClass(
  status: PublishQueueItem["status"],
  hasDraft?: boolean
): string {
  if (status === "published") return "bg-ag-success";
  if (status === "failed") return "bg-ag-danger";
  if (status === "publishing") return "bg-ag-accent animate-pulse";
  if (status === "queued") return "bg-ag-accent";
  if (status === "eligible" && hasDraft) return "bg-ag-warning";
  return "bg-ag-muted/50";
}

export function scheduleOverlayLabel(status: PublishQueueItem["status"]): string {
  if (status === "published") return "No ar";
  if (status === "publishing") return "Publicando";
  if (status === "queued") return "Agendado";
  if (status === "failed") return "Erro";
  return "Rascunho";
}

export function findScheduleConflicts(
  items: PublishQueueItem[],
  draftSchedules: Record<string, string>
): Map<string, PublishQueueItem[]> {
  const byMinute = new Map<string, PublishQueueItem[]>();
  for (const item of items) {
    const iso = resolveItemSchedule(item, draftSchedules);
    if (!iso) continue;
    const d = new Date(iso);
    const key = `${isoToCalendarDateKey(iso)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const list = byMinute.get(key) ?? [];
    list.push(item);
    byMinute.set(key, list);
  }
  const conflicts = new Map<string, PublishQueueItem[]>();
  for (const [key, list] of byMinute) {
    if (list.length > 1) conflicts.set(key, list);
  }
  return conflicts;
}

export function queueItemToPlannedPost(item: PublishQueueItem) {
  return {
    id: item.plannedPostId,
    dayNumber: item.dayNumber,
    dateLabel: item.dateLabel,
    image: item.imageUrl,
    imageAssetId: item.imageAssetId,
    matchedCatalogId: null,
    reasoning: null,
    caption: item.caption,
    isGenerating: false,
    isGenerated: true,
    isConfirmed: item.isConfirmed,
    error: null,
  };
}

export function buildScheduleOverlay(
  queue: PublishQueueItem[],
  draftSchedules: Record<string, string>
): Map<string, { scheduledAt: string; status: PublishQueueItem["status"] }> {
  const map = new Map<string, { scheduledAt: string; status: PublishQueueItem["status"] }>();
  for (const item of queue) {
    const iso = resolveItemSchedule(item, draftSchedules);
    if (!iso) continue;
    if (item.status === "eligible" && !draftSchedules[item.plannedPostId]) continue;
    map.set(item.plannedPostId, { scheduledAt: iso, status: item.status });
  }
  for (const [postId, iso] of Object.entries(draftSchedules)) {
    const existing = queue.find((q) => q.plannedPostId === postId);
    if (existing) {
      map.set(postId, { scheduledAt: iso, status: existing.status === "eligible" ? "queued" : existing.status });
    }
  }
  return map;
}
