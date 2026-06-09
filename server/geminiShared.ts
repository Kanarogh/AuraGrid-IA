import { Type } from "@google/genai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_GEMINI_CATALOG_MODEL = "gemini-2.5-flash-lite";

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export const CATALOG_PROFILE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    version: { type: Type.NUMBER, description: "Always 1" },
    referenceLabel: { type: Type.STRING },
    garmentType: { type: Type.STRING, description: "e.g. dress, saree, lehenga, top" },
    category: { type: Type.STRING, description: "e.g. evening, casual, bridal" },
    dominantColorFamily: { type: Type.STRING, description: "Specific dominant shade" },
    colorTemperature: { type: Type.STRING, description: "warm, cool, or neutral" },
    primaryColors: { type: Type.ARRAY, items: { type: Type.STRING } },
    secondaryColors: { type: Type.ARRAY, items: { type: Type.STRING } },
    pattern: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, description: "solid, floral, striped, lace, geometric, etc." },
        description: { type: Type.STRING },
      },
      required: ["type", "description"],
    },
    printScale: { type: Type.STRING, description: "solid, micro, small, medium, large, all-over" },
    neckline: { type: Type.STRING },
    sleeves: { type: Type.STRING },
    sleeveType: { type: Type.STRING },
    dressLength: { type: Type.STRING },
    lengthCategory: { type: Type.STRING, description: "mini, knee, midi, maxi, ankle, floor" },
    silhouette: { type: Type.STRING },
    fabricTexture: { type: Type.STRING },
    embellishments: { type: Type.ARRAY, items: { type: Type.STRING } },
    distinctiveDetails: { type: Type.ARRAY, items: { type: Type.STRING } },
    matchAnchors: { type: Type.ARRAY, items: { type: Type.STRING } },
    notToConfuseWith: { type: Type.STRING },
    matchKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    visualSummary: { type: Type.STRING },
    distinguishingFingerprint: { type: Type.STRING },
  },
  required: [
    "version",
    "referenceLabel",
    "garmentType",
    "category",
    "dominantColorFamily",
    "colorTemperature",
    "primaryColors",
    "secondaryColors",
    "pattern",
    "printScale",
    "neckline",
    "sleeves",
    "sleeveType",
    "dressLength",
    "lengthCategory",
    "silhouette",
    "fabricTexture",
    "embellishments",
    "distinctiveDetails",
    "matchAnchors",
    "notToConfuseWith",
    "matchKeywords",
    "visualSummary",
    "distinguishingFingerprint",
  ],
};

export function parseRetrySeconds(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error);
  const m = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (m) return Math.ceil(parseFloat(m[1])) + 1;
  return null;
}

/** Cota diária/minuto zerada — retry só prolonga a espera sem chance de sucesso */
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

/** Mensagem curta em português para exibir na UI do catálogo */
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
