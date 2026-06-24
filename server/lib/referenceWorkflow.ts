/** Resolve se o workflow de referências está ativo (herança cliente → roteiro). */
export function resolveUsesReferences(
  clientDefault: boolean | undefined | null,
  periodOverride: boolean | null | undefined
): boolean {
  if (periodOverride === true || periodOverride === false) return periodOverride;
  return clientDefault !== false;
}
