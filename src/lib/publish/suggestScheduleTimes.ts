export type PublishJobStatus =
  | "queued"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export type SlotTemplates = Record<string, string[]>;

export const DEFAULT_SLOT_TEMPLATES: SlotTemplates = {
  "1": ["10:00"],
  "2": ["10:00", "18:00"],
  "3": ["09:00", "14:00", "19:00"],
  "4": ["09:00", "12:00", "16:00", "19:00"],
  "5": ["09:00", "11:30", "14:00", "17:00", "19:30"],
};

export type SchedulePostInput = {
  postId: string;
  dayNumber: number;
  dateLabel?: string;
};

export type ScheduleSuggestion = {
  postId: string;
  dayNumber: number;
  scheduledAt: string;
  timeLabel: string;
  dateLabel: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD a partir de startDate + dayNumber (1-based). */
export function calendarDateForPost(startDate: string, dayNumber: number): string {
  const [y, m, d] = startDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + (dayNumber - 1));
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateLabel(calendarDate: string): string {
  const [y, m, d] = calendarDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" });
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace(".", "");
  const dm = date.toLocaleDateString("pt-BR", { day: "numeric", month: "numeric" });
  return `${capitalized} (${dm})`;
}

/** ISO com offset para agendamento (BRT UTC-3 no MVP). */
export function buildScheduledIso(
  calendarDate: string,
  timeHHmm: string,
  _timezone = "America/Sao_Paulo"
): string {
  const [hh, mm] = timeHHmm.split(":").map(Number);
  return `${calendarDate}T${pad2(hh)}:${pad2(mm)}:00-03:00`;
}

function buildIsoInTimezone(calendarDate: string, timeHHmm: string, timezone: string): string {
  return buildScheduledIso(calendarDate, timeHHmm, timezone);
}

function slotsForCount(count: number, templates: SlotTemplates): string[] {
  const key = String(Math.min(Math.max(count, 1), 5));
  const fromTemplate = templates[key] ?? templates["1"] ?? ["10:00"];
  if (count <= fromTemplate.length) return fromTemplate.slice(0, count);
  const base = fromTemplate[fromTemplate.length - 1] ?? "10:00";
  const result = [...fromTemplate];
  while (result.length < count) {
    const [h, m] = (result[result.length - 1] ?? base).split(":").map(Number);
    const nextH = Math.min(h + 3, 21);
    result.push(`${pad2(nextH)}:${pad2(m)}`);
  }
  return result;
}

export function suggestScheduleTimes(input: {
  startDate: string;
  timezone?: string;
  slotTemplates?: SlotTemplates;
  posts: SchedulePostInput[];
}): ScheduleSuggestion[] {
  const timezone = input.timezone ?? "America/Sao_Paulo";
  const templates = input.slotTemplates ?? DEFAULT_SLOT_TEMPLATES;

  const byDay = new Map<number, SchedulePostInput[]>();
  for (const post of input.posts) {
    const list = byDay.get(post.dayNumber) ?? [];
    list.push(post);
    byDay.set(post.dayNumber, list);
  }

  const suggestions: ScheduleSuggestion[] = [];
  for (const [dayNumber, dayPosts] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...dayPosts].sort((a, b) => a.postId.localeCompare(b.postId));
    const slots = slotsForCount(sorted.length, templates);
    const calendarDate = calendarDateForPost(input.startDate, dayNumber);
    const dateLabel = formatDateLabel(calendarDate);

    sorted.forEach((post, index) => {
      const time = slots[index] ?? "10:00";
      suggestions.push({
        postId: post.postId,
        dayNumber,
        scheduledAt: buildIsoInTimezone(calendarDate, time, timezone),
        timeLabel: time,
        dateLabel: post.dateLabel ?? dateLabel,
      });
    });
  }

  return suggestions;
}
