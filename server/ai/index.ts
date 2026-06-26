import {
  getAiProviderId,
  getEnvDefaultProviderId,
  getEnvGeminiCatalogModel,
  getEnvGeminiModel,
  getGeminiCatalogModel,
  getGeminiModel,
  hasGeminiKey,
} from "./config";
import {
  getRuntimeGeminiCatalogModel,
  getRuntimeGeminiModel,
  setRuntimeGeminiCatalogModel,
  setRuntimeGeminiModel,
  setRuntimeProvider,
} from "./runtimeSettings";
import { GEMINI_MODELS, type GeminiModelOption, sanitizeGeminiModelId } from "./geminiModels";
import { formatAiError } from "./shared";
import { geminiProvider } from "./geminiProvider";
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
  gemini: {
    activeModel: string;
    activeCatalogModel: string;
    envModel: string;
    envCatalogModel: string;
    runtimeModel: string | null;
    runtimeCatalogModel: string | null;
    models: GeminiModelOption[];
  };
};

export { formatAiError };
export type { AiHealthResponse, AiProviderId };

export async function buildAiSettingsResponse(): Promise<AiSettingsResponse> {
  return {
    activeProvider: "gemini",
    envDefaultProvider: getEnvDefaultProviderId(),
    providers: [
      {
        id: "gemini",
        label: "Google Gemini",
        model: getGeminiModel(),
        configured: hasGeminiKey(),
      },
    ],
    gemini: {
      activeModel: getGeminiModel(),
      activeCatalogModel: getGeminiCatalogModel(),
      envModel: getEnvGeminiModel(),
      envCatalogModel: getEnvGeminiCatalogModel(),
      runtimeModel: getRuntimeGeminiModel(),
      runtimeCatalogModel: getRuntimeGeminiCatalogModel(),
      models: GEMINI_MODELS,
    },
  };
}

export async function setGeminiModelOverride(model: string | null): Promise<void> {
  await setRuntimeGeminiModel(model ? sanitizeGeminiModelId(model) : null);
}

export async function setGeminiCatalogModelOverride(model: string | null): Promise<void> {
  await setRuntimeGeminiCatalogModel(model ? sanitizeGeminiModelId(model) : null);
}

export async function setActiveAiProvider(_provider: AiProviderId): Promise<void> {
  await setRuntimeProvider("gemini");
}

export function getActiveProviderId(): AiProviderId {
  return "gemini";
}

export function getProvider(_id: AiProviderId): AiProvider {
  return geminiProvider;
}

export function getActiveProvider(): AiProvider {
  const provider = geminiProvider;
  if (!provider.isConfigured()) {
    throw new Error("GEMINI_API_KEY não está configurada no .env.");
  }
  return provider;
}

export function buildHealthResponse(): AiHealthResponse {
  const active = getActiveProvider();

  return {
    status: "healthy",
    provider: getAiProviderId(),
    model: active.isConfigured() ? active.getModel() : getGeminiModel(),
    keyConfigured: active.isConfigured(),
    providers: {
      gemini: { configured: hasGeminiKey(), model: getGeminiModel() },
    },
    apiVersion: 7,
    features: {
      catalogEnrich: active.isConfigured(),
      catalogJsonMatch: true,
      fallbackChain: false,
    },
    circuitBreaker: {
      gemini: {
        inCooldown: false,
        cooldownUntil: 0,
        lastError: null,
        failures: 0,
      },
    },
  };
}
