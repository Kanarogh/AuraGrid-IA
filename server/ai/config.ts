import { sanitizeGeminiModelId } from "./geminiModels";
import { getRuntimeGeminiCatalogModel, getRuntimeGeminiModel } from "./runtimeSettings";
import type { AiProviderId } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_GEMINI_CATALOG_MODEL = "gemini-2.5-flash-lite";

export function getEnvDefaultProviderId(): AiProviderId {
  return "gemini";
}

export function getAiProviderId(): AiProviderId {
  return "gemini";
}

export function getGeminiModel(): string {
  const raw = getRuntimeGeminiModel() || process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return sanitizeGeminiModelId(raw) ?? DEFAULT_GEMINI_MODEL;
}

export function getGeminiCatalogModel(): string {
  const raw =
    getRuntimeGeminiCatalogModel() ||
    process.env.GEMINI_CATALOG_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_CATALOG_MODEL;
  return sanitizeGeminiModelId(raw) ?? DEFAULT_GEMINI_CATALOG_MODEL;
}

export function getEnvGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function getEnvGeminiCatalogModel(): string {
  return (
    process.env.GEMINI_CATALOG_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_CATALOG_MODEL
  );
}

export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim();
}

export function isAiFallbackAllowed(): boolean {
  return false;
}
