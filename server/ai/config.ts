import { sanitizeGeminiModelId } from "./geminiModels";
import {
  getRuntimeGeminiContentScheduleModel,
  getRuntimeGeminiIndexingModel,
  getRuntimeGeminiPlanningModel,
  getRuntimeGeminiReferenceModel,
} from "./runtimeSettings";
import type { AiProviderId } from "./types";

export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
export const DEFAULT_GEMINI_CATALOG_MODEL = "gemini-2.5-flash-lite";

export function getEnvDefaultProviderId(): AiProviderId {
  return "gemini";
}

export function getAiProviderId(): AiProviderId {
  return "gemini";
}

export function getGeminiModel(): string {
  const raw =
    getRuntimeGeminiPlanningModel() ||
    process.env.GEMINI_PLANNING_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;
  return sanitizeGeminiModelId(raw) ?? DEFAULT_GEMINI_MODEL;
}

export function getGeminiCatalogModel(): string {
  return getGeminiIndexingModel();
}

export function getGeminiPlanningModel(): string {
  return getGeminiModel();
}

export function getGeminiIndexingModel(): string {
  const raw =
    getRuntimeGeminiIndexingModel() ||
    process.env.GEMINI_INDEXING_MODEL?.trim() ||
    process.env.GEMINI_CATALOG_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_CATALOG_MODEL;
  return sanitizeGeminiModelId(raw) ?? DEFAULT_GEMINI_CATALOG_MODEL;
}

export function getGeminiContentScheduleModel(): string {
  const raw =
    getRuntimeGeminiContentScheduleModel() ||
    process.env.GEMINI_CONTENT_SCHEDULE_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;
  return sanitizeGeminiModelId(raw) ?? DEFAULT_GEMINI_MODEL;
}

export function getGeminiReferenceModel(): string {
  const raw =
    getRuntimeGeminiReferenceModel() ||
    process.env.GEMINI_REFERENCE_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;
  return sanitizeGeminiModelId(raw) ?? DEFAULT_GEMINI_MODEL;
}

export function getEnvGeminiModel(): string {
  return (
    process.env.GEMINI_PLANNING_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL
  );
}

export function getEnvGeminiCatalogModel(): string {
  return getEnvGeminiIndexingModel();
}

export function getEnvGeminiPlanningModel(): string {
  return getEnvGeminiModel();
}

export function getEnvGeminiIndexingModel(): string {
  return (
    process.env.GEMINI_INDEXING_MODEL?.trim() ||
    process.env.GEMINI_CATALOG_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_CATALOG_MODEL
  );
}

export function getEnvGeminiContentScheduleModel(): string {
  return (
    process.env.GEMINI_CONTENT_SCHEDULE_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL
  );
}

export function getEnvGeminiReferenceModel(): string {
  return (
    process.env.GEMINI_REFERENCE_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL
  );
}

export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim();
}

export function isAiFallbackAllowed(): boolean {
  return false;
}
