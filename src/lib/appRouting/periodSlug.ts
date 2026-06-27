import type { PlanningPeriod } from "../planningConstants";

export type PeriodRouteRef = Pick<PlanningPeriod, "id" | "startDate" | "status"> & {
  updatedAt?: string;
};

const MONTH_SLUG = /^\d{4}-\d{2}$/;
const DATE_SLUG = /^\d{4}-\d{2}-\d{2}$/;

/** ID interno legado (ex.: palak-euro__period_default ou palak-euro_period_123). */
export function isLegacyPeriodQuery(value: string): boolean {
  return value.includes("__period_") || /_period_\d/.test(value);
}

/** Slug legível na URL — YYYY-MM ou YYYY-MM-DD se houver colisão no mesmo mês. */
export function periodToUrlSlug(
  period: PeriodRouteRef,
  allPeriods?: PeriodRouteRef[]
): string {
  const month = period.startDate.slice(0, 7);
  if (!allPeriods?.length) return month;

  const sameMonth = allPeriods.filter((p) => p.startDate.startsWith(month));
  if (sameMonth.length <= 1) return month;
  return period.startDate.slice(0, 10);
}

export function periodIdToUrlSlug(
  periodId: string,
  periods: PeriodRouteRef[]
): string | undefined {
  const period = periods.find((p) => p.id === periodId);
  if (!period) return undefined;
  return periodToUrlSlug(period, periods);
}

/** Resolve valor bruto de ?period= → id interno do roteiro. */
export function resolvePeriodQueryToId(
  periods: PeriodRouteRef[],
  query: string | undefined
): string | undefined {
  if (!query?.trim() || periods.length === 0) return undefined;

  const raw = query.trim();

  const byId = periods.find((p) => p.id === raw);
  if (byId) return byId.id;

  if (isLegacyPeriodQuery(raw)) {
    const legacy = periods.find((p) => p.id === raw);
    return legacy?.id;
  }

  if (DATE_SLUG.test(raw)) {
    const matches = periods.filter((p) => p.startDate.startsWith(raw));
    if (matches.length === 1) return matches[0]!.id;
    if (matches.length > 1) {
      const active = matches.find((p) => p.status === "active");
      return (active ?? matches[0])!.id;
    }
    return undefined;
  }

  if (MONTH_SLUG.test(raw)) {
    const matches = periods.filter((p) => p.startDate.startsWith(raw));
    if (matches.length === 1) return matches[0]!.id;
    if (matches.length > 1) {
      const active = matches.filter((p) => p.status === "active");
      if (active.length === 1) return active[0]!.id;
      const sorted = [...matches].sort(
        (a, b) => new Date(b.updatedAt ?? b.startDate).getTime() - new Date(a.updatedAt ?? a.startDate).getTime()
      );
      return sorted[0]!.id;
    }
    return undefined;
  }

  return undefined;
}

/** Indica se a query na URL usa formato legado (precisa canonical replace). */
export function periodQueryNeedsCanonicalReplace(
  query: string | undefined,
  periods: PeriodRouteRef[],
  resolvedPeriodId: string | undefined
): boolean {
  if (!query?.trim() || !resolvedPeriodId) return false;
  const canonical = periodIdToUrlSlug(resolvedPeriodId, periods);
  return Boolean(canonical && canonical !== query.trim());
}
