export const DEFAULT_START_DATE = "2026-05-24";
export const POST_COUNT = 30;

export type PlanningPeriodStatus = "active" | "archived" | "draft";

export type PlanningPeriod = {
  id: string;
  label: string;
  startDate: string;
  status: PlanningPeriodStatus;
  campaignContext?: string;
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
    return "Roteiro";
  }
}

export function createDefaultPlanningPeriod(
  clientId: string,
  startDate = DEFAULT_START_DATE
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
