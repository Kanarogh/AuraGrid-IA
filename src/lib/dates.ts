import type { PlannedPost } from "../types";

/** Normaliza coluna `date` / string ISO para YYYY-MM-DD (evita shift de fuso no input type=date). */
export function toDateOnlyString(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1]! : value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value);
}

export function recalculatePostDates(
  startDateStr: string,
  currentPosts: PlannedPost[]
): PlannedPost[] {
  if (!startDateStr) return currentPosts;
  try {
    const [year, month, day] = startDateStr.split("-").map(Number);
    return currentPosts.map((post) => {
      const dayOffset = post.dayNumber - 1;
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + dayOffset);

      const weekdayStr = date.toLocaleDateString("pt-BR", { weekday: "short" });
      const capitalizedWeekday =
        weekdayStr.charAt(0).toUpperCase() + weekdayStr.slice(1).replace(".", "");
      const dayMonthStr = date.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "numeric",
      });

      return {
        ...post,
        dateLabel: `${capitalizedWeekday} (${dayMonthStr})`,
      };
    });
  } catch (err) {
    console.error("Erro recalculando datas:", err);
    return currentPosts;
  }
}
