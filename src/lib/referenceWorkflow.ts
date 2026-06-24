import type { ClientMeta, ClientWorkspace } from "./clientWorkspace/types";
import type { PlanningPeriod } from "./planningConstants";

/** Resolve se o workflow de referências está ativo (herança cliente → roteiro). */
export function resolveUsesReferences(
  clientDefault: boolean | undefined,
  periodOverride: boolean | null | undefined
): boolean {
  if (periodOverride === true || periodOverride === false) return periodOverride;
  return clientDefault !== false;
}

export function effectiveUsesReferencesFromParts(
  clientDefault: boolean | undefined,
  period: PlanningPeriod | undefined
): boolean {
  return resolveUsesReferences(clientDefault, period?.usesReferences);
}

export function effectiveUsesReferences(
  workspace: ClientWorkspace,
  clientMeta?: ClientMeta
): boolean {
  const period = workspace.planningPeriods.find(
    (p) => p.id === workspace.activePlanningPeriodId
  );
  return effectiveUsesReferencesFromParts(
    clientMeta?.defaultUsesReferences ?? workspace.defaultUsesReferences,
    period
  );
}
