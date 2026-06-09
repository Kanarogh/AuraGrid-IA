import type { GeminiSettings } from "./aiSettings";

export function geminiModelDisplayLabel(gemini: GeminiSettings): string {
  const main = gemini.models.find((m) => m.id === gemini.activeModel);
  const mainLabel = main?.label ?? gemini.activeModel;
  if (gemini.activeCatalogModel === gemini.activeModel) return mainLabel;

  const catalog = gemini.models.find((m) => m.id === gemini.activeCatalogModel);
  const catalogShort =
    catalog?.label.replace(/^Gemini\s+/i, "") ?? gemini.activeCatalogModel;
  return `${mainLabel} · cat ${catalogShort}`;
}
