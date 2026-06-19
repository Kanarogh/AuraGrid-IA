import type { NextRequest } from "next/server";
import {
  getAiProviderId,
  hasGeminiKey,
  hasGroqKey,
  hasOpenRouterKey,
  isOllamaConfigured,
} from "../ai/config";
import { sanitizeOpenRouterModelId } from "../ai/openrouterModels";
import {
  ensureRuntimeAiSettingsLoaded,
  setRuntimeOpenRouterModel,
  setRuntimeProvider,
} from "../ai/runtimeSettings";
import { withUserAiContext } from "../ai/userAiContext";
import { sanitizeAiAttemptsForHeader, type AiAttemptHeader } from "../ai/httpHeaders";
import { sanitizeForHttpHeader } from "../ai/httpHeaders";
import type { AiProviderId } from "../ai/types";
import { isDatabaseConfigured } from "../db/client";
import { getOptionalUserFromRequest } from "./auth";

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

/** Aplica headers x-ai-* ao runtime (usuário autenticado ou arquivo global). */
export async function applyAiHeadersFromNextRequest(req: NextRequest): Promise<AiProviderId> {
  await ensureRuntimeAiSettingsLoaded();

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

/** Envolve handler com preferências de IA do usuário (PostgreSQL) quando autenticado. */
export async function withUserAiFromRequest<T>(
  req: NextRequest,
  handler: () => Promise<T>
): Promise<T> {
  await ensureRuntimeAiSettingsLoaded();
  const user = await getOptionalUserFromRequest(req);
  if (user && isDatabaseConfigured()) {
    return withUserAiContext(user.id, async () => {
      await applyAiHeadersFromNextRequest(req);
      return handler();
    });
  }
  await applyAiHeadersFromNextRequest(req);
  return handler();
}

/** Valor do header X-AI-Attempts para anexar à resposta. */
export function aiAttemptsHeaderValue(attempts: AiAttemptHeader[]): string {
  return sanitizeForHttpHeader(JSON.stringify(sanitizeAiAttemptsForHeader(attempts)), 4096);
}
