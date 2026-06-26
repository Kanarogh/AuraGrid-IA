import type { GeminiSettings } from "./aiSettings";

const GEMINI_MODEL_LABELS: Record<string, string> = {
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "gemini-3.1-pro-preview": "Gemini 3.1 Pro (preview)",
  "gemini-3-flash-preview": "Gemini 3 Flash (preview)",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
};

export function formatGeminiModelIdLabel(modelId: string): string {
  return GEMINI_MODEL_LABELS[modelId] ?? modelId;
}

export function geminiModelDisplayLabel(gemini: GeminiSettings): string {
  const main = gemini.models.find((m) => m.id === gemini.activeModel);
  const mainLabel = main?.label ?? gemini.activeModel;
  if (gemini.activeCatalogModel === gemini.activeModel) return mainLabel;

  const catalog = gemini.models.find((m) => m.id === gemini.activeCatalogModel);
  const catalogShort =
    catalog?.label.replace(/^Gemini\s+/i, "") ?? gemini.activeCatalogModel;
  return `${mainLabel} · cat ${catalogShort}`;
}
