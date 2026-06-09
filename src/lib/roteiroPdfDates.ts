import type { PlannedPost } from "../types";

export function getPostCalendarDay(post: PlannedPost, startDate: string): string {
  const fromLabel = post.dateLabel.match(/\((\d{1,2})/);
  if (fromLabel) return fromLabel[1];

  try {
    const [year, month, day] = startDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + post.dayNumber - 1);
    return String(date.getDate());
  } catch {
    return String(post.dayNumber);
  }
}

export function getPostWeekdayLabel(post: PlannedPost): string {
  const fromLabel = post.dateLabel.match(/^([^\s(]+)/);
  if (fromLabel?.[1]) return fromLabel[1];
  return `Dia ${post.dayNumber}`;
}

const WEEKDAY_ABBR: Record<string, string> = {
  domingo: "DOM",
  segunda: "SEG",
  terça: "TER",
  terca: "TER",
  quarta: "QUA",
  quinta: "QUI",
  sexta: "SEX",
  sábado: "SÁB",
  sabado: "SÁB",
  dom: "DOM",
  seg: "SEG",
  ter: "TER",
  qua: "QUA",
  qui: "QUI",
  sex: "SEX",
  sáb: "SÁB",
  sab: "SÁB",
};

/** Sigla de 3 letras para caber no badge do PDF sem quebrar linha. */
export function getPostWeekdayShort(post: PlannedPost, startDate: string): string {
  try {
    const [year, month, day] = startDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + post.dayNumber - 1);
    const raw = date
      .toLocaleDateString("pt-BR", { weekday: "short" })
      .replace(/\./g, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const key = raw.slice(0, 3).toLowerCase();
    return WEEKDAY_ABBR[key] ?? raw.slice(0, 3).toUpperCase();
  } catch {
    const fromLabel = post.dateLabel.match(/^([^\s(]+)/);
    if (fromLabel?.[1]) {
      const word = fromLabel[1]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      for (const [prefix, abbr] of Object.entries(WEEKDAY_ABBR)) {
        if (word.startsWith(prefix)) return abbr;
      }
      return fromLabel[1].slice(0, 3).toUpperCase();
    }
    return `D${post.dayNumber}`;
  }
}

export function formatRoteiroPeriod(startDate: string, postCount: number): string {
  try {
    const [year, month, day] = startDate.split("-").map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(0, postCount - 1));
    const fmt = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${fmt(start)} — ${fmt(end)}`;
  } catch {
    return startDate;
  }
}
