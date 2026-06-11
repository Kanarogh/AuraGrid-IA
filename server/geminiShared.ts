import { Type } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_GEMINI_CATALOG_MODEL = "gemini-2.5-flash-lite";

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export const CATALOG_PROFILE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    version: { type: Type.NUMBER, description: "Always 2" },
    referenceLabel: { type: Type.STRING },
    garment: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING },
        colors: { type: Type.ARRAY, items: { type: Type.STRING } },
        temp: { type: Type.STRING },
        motif: { type: Type.STRING },
        layout: { type: Type.STRING },
        scale: { type: Type.STRING },
        back: { type: Type.STRING },
        neck: { type: Type.STRING },
        sleeve: { type: Type.STRING },
        len: { type: Type.STRING },
        skirt: { type: Type.STRING },
        sil: { type: Type.STRING },
        anchors: { type: Type.ARRAY, items: { type: Type.STRING } },
        not: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["type", "colors", "motif", "anchors"],
    },
    scene: {
      type: Type.OBJECT,
      properties: {
        setting: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        light: { type: Type.STRING },
        mood: { type: Type.STRING },
      },
      required: ["setting", "tags", "light"],
    },
  },
  required: ["version", "referenceLabel", "garment", "scene"],
};

export function parseRetrySeconds(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error);
  const m = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (m) return Math.ceil(parseFloat(m[1])) + 1;
  return null;
}

export function isGeminiQuotaExhausted(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /limit:\s*0\b/i.test(msg) ||
    /RESOURCE_EXHAUSTED/i.test(msg) ||
    /quota exceeded/i.test(msg)
  );
}

export function shouldRetryGeminiError(error: unknown): boolean {
  if (isGeminiQuotaExhausted(error)) return false;
  return parseRetrySeconds(error) !== null;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function formatGeminiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(raw)) {
    return "Cota da API Gemini esgotada (429). Aguarde o reset diário, use outra chave em .env ou ative billing em ai.google.dev.";
  }
  if (/404|not found|model/i.test(raw) && /models\//i.test(raw)) {
    return `Modelo inválido. Defina GEMINI_MODEL no .env (atual: ${getGeminiModel()}).`;
  }
  if (raw.length > 280) {
    return `${raw.slice(0, 280)}…`;
  }
  return raw || "Falha na chamada à API Gemini.";
}
