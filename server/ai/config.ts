import type { AiProviderId } from "./types.ts";
import { sanitizeOpenRouterModelId } from "./openrouterModels.ts";
import {
  getRuntimeOpenRouterModel,
  getRuntimeProviderOverride,
} from "./runtimeSettings.ts";

export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
export const DEFAULT_GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
/** Roteador free com visão quando disponível (evita IDs que saíram do ar). */
export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";

export function getEnvDefaultProviderId(): AiProviderId {
  const raw = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  if (raw === "groq" || raw === "grog") return "groq";
  if (raw === "deepseek") return "deepseek";
  if (raw === "openrouter") return "openrouter";
  return "gemini";
}

/** Prioridade: escolha na plataforma (.auragrid-ai.json) → AI_PROVIDER no .env */
export function getAiProviderId(): AiProviderId {
  return getRuntimeProviderOverride() ?? getEnvDefaultProviderId();
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim();
}

export function hasGroqKey(): boolean {
  return !!process.env.GROQ_API_KEY?.trim();
}

export function getDeepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;
}

export function hasDeepSeekKey(): boolean {
  return !!process.env.DEEPSEEK_API_KEY?.trim();
}

export function getOpenRouterModel(): string {
  const raw =
    getRuntimeOpenRouterModel() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    DEFAULT_OPENROUTER_MODEL;
  return sanitizeOpenRouterModelId(raw) ?? raw;
}

/** Apenas o valor do .env, sem override de runtime — útil para o painel. */
export function getEnvOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

export function hasOpenRouterKey(): boolean {
  return !!process.env.OPENROUTER_API_KEY?.trim();
}
