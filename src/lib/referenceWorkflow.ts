import type { CatalogItem } from "../types";
import type { ClientMeta, ClientWorkspace } from "./clientWorkspace/types";
import { getReferenceCatalog, isCatalogItemIndexed } from "./catalog";
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

/** Referências do acervo com indexação JSON pronta (ready + visualProfile). */
export function countIndexedReferences(catalog: CatalogItem[]): number {
  return getReferenceCatalog(catalog).filter(isCatalogItemIndexed).length;
}

export function buildDisableReferencesConfirmMessage(count: number): string {
  const noun = count === 1 ? "referência indexada" : "referências indexadas";
  return `Este roteiro tem ${count} ${noun}. Elas não serão apagadas, só ficarão ocultas. Legendas passarão a usar só a foto. Continuar?`;
}
