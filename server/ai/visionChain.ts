import {
  hasGeminiKey,
  hasGroqKey,
  hasOpenRouterKey,
  isAiFallbackAllowed,
  isOllamaConfigured,
} from "./config";
import { getProvider } from "./index";
import { isQuotaExhausted } from "./shared";
import type { AiProviderId } from "./types";

export type FallbackOutcome<T> = {
  result: T;
  providerUsed: AiProviderId;
  modelLabel?: string;
  attempts: Array<{ provider: AiProviderId; error?: string; skipped?: string }>;
};

const AURAGRID_ROUTED_MODEL_KEY = "__auragridRoutedModel";

export function stripAuraGridMeta<T extends Record<string, unknown>>(result: T): {
  profile: T;
  routedModel?: string;
} {
  if (!(AURAGRID_ROUTED_MODEL_KEY in result)) {
    return { profile: result };
  }
  const { [AURAGRID_ROUTED_MODEL_KEY]: routed, ...profile } = result;
  return {
    profile: profile as T,
    routedModel: typeof routed === "string" ? routed : undefined,
  };
}

/** Apenas o provedor escolhido (padrão). */
function strictProviderChain(active: AiProviderId): AiProviderId[] {
  const provider = getProvider(active);
  return provider.isConfigured() ? [active] : [];
}

/** Cadeia legada — só com AI_ALLOW_FALLBACK=1. */
function legacyVisionChain(active: AiProviderId): AiProviderId[] {
  if (active === "ollama") {
    const chain: AiProviderId[] = [];
    if (isOllamaConfigured()) chain.push("ollama");
    if (process.env.OLLAMA_CLOUD_FALLBACK === "1") {
      if (hasGeminiKey() && !chain.includes("gemini")) chain.push("gemini");
      if (hasGroqKey() && !chain.includes("groq")) chain.push("groq");
      if (hasOpenRouterKey() && !chain.includes("openrouter")) chain.push("openrouter");
    }
    return chain;
  }

  if (active === "openrouter") {
    const chain: AiProviderId[] = [];
    if (hasOpenRouterKey()) chain.push("openrouter");
    if (hasGroqKey() && !chain.includes("groq")) chain.push("groq");
    if (hasGeminiKey() && !chain.includes("gemini")) chain.push("gemini");
    return chain;
  }

  const chain: AiProviderId[] = [];

  if (active === "gemini" && hasGeminiKey()) chain.push("gemini");
  else if (active === "groq" && hasGroqKey()) chain.push("groq");

  if (active === "gemini" && hasGroqKey() && !chain.includes("groq")) chain.push("groq");
  if (active === "groq" && hasGeminiKey() && !chain.includes("gemini")) chain.push("gemini");

  if (hasOpenRouterKey() && !chain.includes("openrouter")) chain.push("openrouter");
  if (isOllamaConfigured() && !chain.includes("ollama")) chain.push("ollama");

  return chain;
}

export function buildVisionProviderChain(active: AiProviderId): AiProviderId[] {
  return isAiFallbackAllowed() ? legacyVisionChain(active) : strictProviderChain(active);
}

export function shouldTryNextProvider(err: unknown): boolean {
  if (isQuotaExhausted(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /429|RESOURCE_EXHAUSTED|rate.?limit|timeout|timed out|ETIMEDOUT|503|502|insufficient_quota|image_url|unknown variant.*text|no endpoints found|resposta vazia|indisponível no OpenRouter|perfil json incompleto|incompletecatalogprofile|todos os modelos de visão falharam|does not have access to model|model.*not found|invalid model/i.test(
    msg
  );
}
