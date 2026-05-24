import type { Request } from "express";
import {
  getAiProviderId,
  hasGeminiKey,
  hasGroqKey,
  hasOpenRouterKey,
  isOllamaConfigured,
} from "./config.ts";
import { sanitizeOpenRouterModelId } from "./openrouterModels.ts";
import {
  setRuntimeOpenRouterModel,
  setRuntimeProvider,
} from "./runtimeSettings.ts";
import type { AiProviderId } from "./types.ts";

function isValidProvider(value: unknown): value is AiProviderId {
  return (
    value === "gemini" ||
    value === "groq" ||
    value === "openrouter" ||
    value === "ollama"
  );
}

function isProviderConfigured(id: AiProviderId): boolean {
  if (id === "gemini") return hasGeminiKey();
  if (id === "groq") return hasGroqKey();
  if (id === "openrouter") return hasOpenRouterKey();
  if (id === "ollama") return isOllamaConfigured();
  return false;
}

/** Sincroniza provedor/modelo enviados pelo frontend com o runtime do servidor. */
export async function applyAiHeadersFromRequest(req: Request): Promise<AiProviderId> {
  const headerProvider = req.headers["x-ai-provider"];
  if (typeof headerProvider === "string" && isValidProvider(headerProvider)) {
    if (isProviderConfigured(headerProvider)) {
      await setRuntimeProvider(headerProvider);
    }
  }

  const headerModel = req.headers["x-openrouter-model"];
  if (typeof headerModel === "string" && headerModel.trim()) {
    const sanitized = sanitizeOpenRouterModelId(headerModel.trim());
    if (sanitized) {
      await setRuntimeOpenRouterModel(sanitized);
    }
  }

  return getAiProviderId();
}
