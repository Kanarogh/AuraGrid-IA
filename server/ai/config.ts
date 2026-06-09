import type { AiProviderId } from "./types";
import { sanitizeOpenRouterModelId } from "./openrouterModels";
import { sanitizeGeminiModelId } from "./geminiModels";
import {
  getRuntimeOpenRouterModel,
  getRuntimeProviderOverride,
  getRuntimeGeminiModel,
  getRuntimeGeminiCatalogModel,
} from "./runtimeSettings";

/** Match, legenda com imagem, refinar (visão/texto geral). */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
/** Indexação em lote — maior cota free (1.000 req/dia no tier Google). */
export const DEFAULT_GEMINI_CATALOG_MODEL = "gemini-2.5-flash-lite";
export const DEFAULT_GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
/** Primário OpenRouter free (jun/2026): Gemma 4 31B; roteador só como fallback. */
export const DEFAULT_OPENROUTER_MODEL = "google/gemma-4-31b-it:free";
export const DEFAULT_OLLAMA_MODEL = "gemma4";
export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export function getEnvDefaultProviderId(): AiProviderId {
  const raw = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  if (raw === "groq" || raw === "grog") return "groq";
  if (raw === "openrouter") return "openrouter";
  if (raw === "ollama" || raw === "local") return "ollama";
  return "gemini";
}

/** Prioridade: escolha na plataforma (.auragrid-ai.json) → AI_PROVIDER no .env */
export function getAiProviderId(): AiProviderId {
  return getRuntimeProviderOverride() ?? getEnvDefaultProviderId();
}

export function getGeminiModel(): string {
  const raw =
    getRuntimeGeminiModel() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_GEMINI_MODEL;
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

/** Apenas .env — sem override de runtime (painel IA). */
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

export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim();
}

export function hasGroqKey(): boolean {
  return !!process.env.GROQ_API_KEY?.trim();
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

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL;
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;
}

/** Contexto do modelo local (Gemma/Qwen padrão = 4096 — insuficiente para match+legenda). */
export function getOllamaNumCtx(): number {
  const raw = process.env.OLLAMA_NUM_CTX?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 16_384;
  return Number.isFinite(n) && n >= 4096 ? n : 16_384;
}

/** Local Ollama ativo (sem API key). Defina OLLAMA_DISABLED=1 para esconder no painel. */
export function isOllamaConfigured(): boolean {
  return process.env.OLLAMA_DISABLED !== "1";
}

/** Por padrão só o provedor/modelo escolhido no painel. Defina AI_ALLOW_FALLBACK=1 para cadeia antiga. */
export function isAiFallbackAllowed(): boolean {
  const v = process.env.AI_ALLOW_FALLBACK?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
