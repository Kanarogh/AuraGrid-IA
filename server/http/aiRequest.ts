import type { NextRequest } from "next/server";
import {
  getAiProviderId,
  hasGeminiKey,
  hasGroqKey,
  hasOpenRouterKey,
  isOllamaConfigured,
} from "../ai/config";
import { sanitizeOpenRouterModelId } from "../ai/openrouterModels";
import { setRuntimeOpenRouterModel, setRuntimeProvider } from "../ai/runtimeSettings";
import { sanitizeAiAttemptsForHeader, type AiAttemptHeader } from "../ai/httpHeaders";
import { sanitizeForHttpHeader } from "../ai/httpHeaders";
import type { AiProviderId } from "../ai/types";

function isValidProvider(value: unknown): value is AiProviderId {
  return value === "gemini" || value === "groq" || value === "openrouter" || value === "ollama";
}

function isProviderConfigured(id: AiProviderId): boolean {
  if (id === "gemini") return hasGeminiKey();
  if (id === "groq") return hasGroqKey();
  if (id === "openrouter") return hasOpenRouterKey();
  if (id === "ollama") return isOllamaConfigured();
  return false;
}

/** Sincroniza provedor/modelo enviados pelo frontend (headers) com o runtime do servidor. */
export async function applyAiHeadersFromNextRequest(req: NextRequest): Promise<AiProviderId> {
  const headerProvider = req.headers.get("x-ai-provider");
  if (headerProvider && isValidProvider(headerProvider) && isProviderConfigured(headerProvider)) {
    await setRuntimeProvider(headerProvider);
  }

  const headerModel = req.headers.get("x-openrouter-model");
  if (headerModel && headerModel.trim()) {
    const sanitized = sanitizeOpenRouterModelId(headerModel.trim());
    if (sanitized) await setRuntimeOpenRouterModel(sanitized);
  }

  return getAiProviderId();
}

/** Valor do header X-AI-Attempts para anexar à resposta. */
export function aiAttemptsHeaderValue(attempts: AiAttemptHeader[]): string {
  return sanitizeForHttpHeader(JSON.stringify(sanitizeAiAttemptsForHeader(attempts)), 4096);
}
