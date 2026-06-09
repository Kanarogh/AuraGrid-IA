import {
  getAiProviderId,
  getEnvDefaultProviderId,
  getGeminiModel,
  getGroqModel,
  getOpenRouterModel,
  getOllamaModel,
  hasGeminiKey,
  hasGroqKey,
  hasOpenRouterKey,
  isOllamaConfigured,
  isAiFallbackAllowed,
} from "./config";
import {
  getRuntimeOpenRouterModel,
  setRuntimeOpenRouterModel,
  setRuntimeProvider,
} from "./runtimeSettings";
import { OPENROUTER_MODELS, type OpenRouterModelOption } from "./openrouterModels";
import {
  listLiveOpenRouterModels,
  mergeOpenRouterModelsForUi,
  clearOpenRouterModelsCache,
  type OpenRouterModelsFilter,
} from "./openrouterModelsLive";
import { formatAiError } from "./shared";
import { getCircuitBreakerSnapshot } from "./circuitBreaker";
import { geminiProvider } from "./geminiProvider";
import { groqProvider } from "./groqProvider";
import { openrouterProvider } from "./openrouterProvider";
import { ollamaProvider } from "./ollamaProvider";
import type { AiHealthResponse, AiProvider, AiProviderId } from "./types";

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
  openrouter: "OpenRouter (free vision)",
  ollama: "Ollama (Gemma 4 local)",
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
    providers: (["gemini", "groq", "openrouter", "ollama"] as const).map((id) => ({
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
  if (id === "openrouter") return openrouterProvider;
  if (id === "ollama") return ollamaProvider;
  return geminiProvider;
}

function defaultModelFor(id: AiProviderId): string {
  if (id === "groq") return getGroqModel();
  if (id === "openrouter") return getOpenRouterModel();
  if (id === "ollama") return getOllamaModel();
  return getGeminiModel();
}

function envKeyFor(id: AiProviderId): string {
  if (id === "groq") return "GROQ_API_KEY";
  if (id === "openrouter") return "OPENROUTER_API_KEY";
  if (id === "ollama") return "OLLAMA (local)";
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
  const breaker = getCircuitBreakerSnapshot();

  return {
    status: "healthy",
    provider: providerId,
    model: active.isConfigured() ? active.getModel() : defaultModelFor(providerId),
    keyConfigured: active.isConfigured(),
    providers: {
      gemini: { configured: hasGeminiKey(), model: getGeminiModel() },
      groq: { configured: hasGroqKey(), model: getGroqModel() },
      openrouter: { configured: hasOpenRouterKey(), model: getOpenRouterModel() },
      ollama: { configured: isOllamaConfigured(), model: getOllamaModel() },
    },
    apiVersion: 6,
    features: {
      catalogEnrich: active.isConfigured(),
      catalogJsonMatch: true,
      fallbackChain: isAiFallbackAllowed(),
    },
    circuitBreaker: breaker,
  };
}
