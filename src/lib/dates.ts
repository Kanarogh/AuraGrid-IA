import type { PlannedPost } from "../types";

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
