/** Mantém a legenda exatamente como gerada — sem remover emojis nem colapsar parágrafos */
export function normalizeCaptionForPdf(text: string): string {
  return text.replace(/\r\n/g, "\n").trimEnd();
}

export function sanitizeBadgeMetaForPdf(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
