/** Data local YYYY-MM-DD — dia de hoje no fuso do servidor. */
export function defaultPlanningStartDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @deprecated use defaultPlanningStartDate() — evita data fixa desatualizada */
export const DEFAULT_START_DATE = defaultPlanningStartDate();
