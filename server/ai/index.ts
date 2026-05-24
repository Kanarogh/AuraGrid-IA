import {
  getAiProviderId,
  getDeepSeekModel,
  getEnvDefaultProviderId,
  getGeminiModel,
  getGroqModel,
  getOpenRouterModel,
  hasDeepSeekKey,
  hasGeminiKey,
  hasGroqKey,
  hasOpenRouterKey,
} from "./config.ts";
import {
  getRuntimeOpenRouterModel,
  setRuntimeOpenRouterModel,
  setRuntimeProvider,
} from "./runtimeSettings.ts";
import { OPENROUTER_MODELS, type OpenRouterModelOption } from "./openrouterModels.ts";
import {
  listLiveOpenRouterModels,
  mergeOpenRouterModelsForUi,
  clearOpenRouterModelsCache,
  type OpenRouterModelsFilter,
} from "./openrouterModelsLive.ts";
import { deepseekProvider } from "./deepseekProvider.ts";
import { formatAiError } from "./shared.ts";
import { getVisionDelegateId } from "./visionDelegate.ts";
import { getCircuitBreakerSnapshot } from "./circuitBreaker.ts";
import { geminiProvider } from "./geminiProvider.ts";
import { groqProvider } from "./groqProvider.ts";
import { openrouterProvider } from "./openrouterProvider.ts";
import type { AiHealthResponse, AiProvider, AiProviderId } from "./types.ts";

export type AiProviderOption = {
  id: AiProviderId;
  label: string;
  model: string;
  configured: boolean;
};

export type AiSettingsResponse = {
  activeProvider: AiProviderId;
  envDefaultProvider: AiProviderId;
  providers: AiProviderOption[];
  openrouter: {
    activeModel: string;
    runtimeOverride: string | null;
    models: OpenRouterModelOption[];
    liveFetchedAt: string | null;
    liveCount: number;
  };
};

export type { OpenRouterModelsFilter };
export { listLiveOpenRouterModels, clearOpenRouterModelsCache };

export { formatAiError };
export type { AiHealthResponse, AiProviderId };

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  gemini: "Google Gemini",
  groq: "Groq (Llama 4 Scout)",
  deepseek: "DeepSeek V4",
  openrouter: "OpenRouter (free vision)",
};

export async function buildAiSettingsResponse(options?: {
  refreshOpenRouter?: boolean;
}): Promise<AiSettingsResponse> {
  const activeProvider = getAiProviderId();

  let openrouterModels: OpenRouterModelOption[] = OPENROUTER_MODELS.map((m) => ({
    ...m,
    availableNow: false,
    source: "curated" as const,
  }));
  let liveFetchedAt: string | null = null;
  let liveCount = 0;

  if (hasOpenRouterKey()) {
    const apiKey = process.env.OPENROUTER_API_KEY!.trim();
    try {
      const { models: live, fetchedAt } = await listLiveOpenRouterModels(apiKey, {
        refresh: options?.refreshOpenRouter,
        filter: "vision-text",
      });
      liveCount = live.length;
      liveFetchedAt = fetchedAt;
      openrouterModels = mergeOpenRouterModelsForUi(live, OPENROUTER_MODELS);
    } catch (err) {
      console.warn(
        "[OpenRouter] Falha ao listar modelos live:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return {
    activeProvider,
    envDefaultProvider: getEnvDefaultProviderId(),
    providers: (["gemini", "groq", "deepseek", "openrouter"] as const).map((id) => ({
      id,
      label: PROVIDER_LABELS[id],
      model: defaultModelFor(id),
      configured: getProvider(id).isConfigured(),
    })),
    openrouter: {
      activeModel: getOpenRouterModel(),
      runtimeOverride: getRuntimeOpenRouterModel(),
      models: openrouterModels,
      liveFetchedAt,
      liveCount,
    },
  };
}

export async function setOpenRouterModelOverride(model: string | null): Promise<void> {
  await setRuntimeOpenRouterModel(model);
}

export async function setActiveAiProvider(provider: AiProviderId): Promise<void> {
  const p = getProvider(provider);
  if (!p.isConfigured()) {
    throw new Error(
      `Chave não configurada para ${PROVIDER_LABELS[provider]}. Adicione a API key no .env (reinicie o servidor só após mudar chaves).`
    );
  }
  await setRuntimeProvider(provider);
}

export function getActiveProviderId(): AiProviderId {
  return getAiProviderId();
}

export function getProvider(id: AiProviderId): AiProvider {
  if (id === "groq") return groqProvider;
  if (id === "deepseek") return deepseekProvider;
  if (id === "openrouter") return openrouterProvider;
  return geminiProvider;
}

function defaultModelFor(id: AiProviderId): string {
  if (id === "groq") return getGroqModel();
  if (id === "deepseek") return getDeepSeekModel();
  if (id === "openrouter") return getOpenRouterModel();
  return getGeminiModel();
}

function envKeyFor(id: AiProviderId): string {
  if (id === "groq") return "GROQ_API_KEY";
  if (id === "deepseek") return "DEEPSEEK_API_KEY";
  if (id === "openrouter") return "OPENROUTER_API_KEY";
  return "GEMINI_API_KEY";
}

export function getActiveProvider(): AiProvider {
  const id = getActiveProviderId();
  const provider = getProvider(id);

  if (!provider.isConfigured()) {
    throw new Error(
      `AI_PROVIDER=${id} mas ${envKeyFor(id)} não está no .env. Configure a chave ou mude AI_PROVIDER.`
    );
  }

  return provider;
}

export function buildHealthResponse(): AiHealthResponse {
  const providerId = getActiveProviderId();
  const active = getProvider(providerId);
  const visionDelegate = getVisionDelegateId();
  const visionOk = visionDelegate !== null;

  const breaker = getCircuitBreakerSnapshot();

  return {
    status: "healthy",
    provider: providerId,
    model: active.isConfigured() ? active.getModel() : defaultModelFor(providerId),
    keyConfigured: active.isConfigured(),
    providers: {
      gemini: { configured: hasGeminiKey(), model: getGeminiModel() },
      groq: { configured: hasGroqKey(), model: getGroqModel() },
      deepseek: { configured: hasDeepSeekKey(), model: getDeepSeekModel() },
      openrouter: { configured: hasOpenRouterKey(), model: getOpenRouterModel() },
    },
    apiVersion: 5,
    features: {
      catalogEnrich: providerId !== "deepseek" || visionOk,
      catalogJsonMatch: true,
      visionDelegate: providerId === "deepseek" ? visionDelegate : null,
      fallbackChain: true,
    },
    circuitBreaker: breaker,
  };
}
