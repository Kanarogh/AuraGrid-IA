/** Remove linha Referencia quando não há match de catálogo (imagem sem peça). */
export function applyCaptionReferenceRule(caption: string, matchedCatalogId: string | null): string {
  const text = caption.trim();
  if (matchedCatalogId) return text;
  return text.replace(/^\s*Referencia:\s*[^\n]*\n?/gim, "").trim();
}
