import { getProvider } from "./index";
import { sanitizeForHttpHeader } from "./httpHeaders";
import {
  getGeminiIndexingModel,
  getGeminiPlanningModel,
  getGeminiReferenceModel,
} from "./config";
import type { AiProvider, AiProviderId } from "./types";

export type FallbackOutcome<T> = {
  result: T;
  providerUsed: AiProviderId;
  modelLabel?: string;
  attempts: Array<{ provider: AiProviderId; error?: string; skipped?: string }>;
};

export function stripAuraGridMeta<T extends Record<string, unknown>>(result: T): {
  profile: T;
  routedModel?: string;
} {
  return { profile: result };
}

export async function runVisionWithFallback<T>(
  label: string,
  call: (provider: AiProvider) => Promise<T>,
  _activeOverride?: AiProviderId
): Promise<FallbackOutcome<T>> {
  const provider = getProvider("gemini");
  const modelLabel =
    label === "enrich-catalog-item"
      ? getGeminiIndexingModel()
      : label === "match-reference"
        ? getGeminiReferenceModel()
        : getGeminiPlanningModel();
  try {
    const result = await call(provider);
    return {
      result,
      providerUsed: "gemini",
      modelLabel,
      attempts: [{ provider: "gemini" }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const clean = sanitizeForHttpHeader(message, 240);
    throw new Error(`${message}\n\nResumo das tentativas: gemini: ${clean}`);
  }
}
