let catalogMutationInFlight = 0;

export function beginCatalogMutation(): void {
  catalogMutationInFlight += 1;
}

export function endCatalogMutation(): void {
  catalogMutationInFlight = Math.max(0, catalogMutationInFlight - 1);
}

export function isCatalogMutationInFlight(): boolean {
  return catalogMutationInFlight > 0;
}
