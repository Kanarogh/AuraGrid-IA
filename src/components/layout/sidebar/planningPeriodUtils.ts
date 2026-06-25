import type { PlanningPeriod } from "../../../lib/planningConstants";

export function statusLabel(status: PlanningPeriod["status"]) {
  if (status === "active") return "Ativo";
  if (status === "archived") return "Arquivado";
  return "Rascunho";
}

export function formatStartDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function shortPeriodLabel(label: string, startDate: string): string {
  const monthPart = label.split(" de ")[0]?.trim();
  if (monthPart && monthPart.length <= 8) return monthPart;
  const [, m, d] = startDate.split("-");
  if (m && d) return `${d}/${m}`;
  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
}
