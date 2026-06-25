/** Data local YYYY-MM-DD — dia de hoje no fuso do navegador. */
export function defaultPlanningStartDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @deprecated use defaultPlanningStartDate() */
export const DEFAULT_START_DATE = defaultPlanningStartDate();

export const POST_COUNT = 30;

export type PlanningPeriodStatus = "active" | "archived" | "draft";

export type PlanningPeriod = {
  id: string;
  label: string;
  startDate: string;
  status: PlanningPeriodStatus;
  campaignContext?: string;
  /** null = herdar do cliente */
  usesReferences?: boolean | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  filledPostsCount?: number;
};

export function defaultPeriodId(clientId: string, suffix = "default"): string {
  return `${clientId}__period_${suffix}`;
}

export function periodLabelFromDate(startDate: string): string {
  try {
    const [year, month] = startDate.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    const monthName = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  } catch {
    return "Planejamento";
  }
}

export function createDefaultPlanningPeriod(
  clientId: string,
  startDate = defaultPlanningStartDate()
): PlanningPeriod {
  const now = new Date().toISOString();
  return {
    id: defaultPeriodId(clientId),
    label: periodLabelFromDate(startDate),
    startDate,
    status: "active",
    campaignContext: "",
    createdAt: now,
    updatedAt: now,
  };
}
