import { sanitizeGeminiModelId } from "./geminiModels";
import { isGeminiTransientError, sleep, withRetry } from "./shared";

const DEFAULT_FALLBACKS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

const PLANNING_FALLBACKS: Record<string, string[]> = {
  "gemini-3.1-flash-lite": ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
  "gemini-3.5-flash": ["gemini-3.1-flash-lite", "gemini-2.5-flash"],
  "gemini-3-flash-preview": ["gemini-3.1-flash-lite", "gemini-2.5-flash"],
  "gemini-3.1-pro-preview": ["gemini-2.5-pro", "gemini-2.5-flash"],
  "gemini-2.5-pro": ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
};

const INDEXING_FALLBACKS: Record<string, string[]> = {
  "gemini-3.1-flash-lite": ["gemini-2.5-flash-lite"],
  "gemini-2.5-flash-lite": ["gemini-3.1-flash-lite"],
};

function buildModelChain(
  primaryModel: string,
  fallbacks: Record<string, string[]>
): string[] {
  const chain = [primaryModel, ...(fallbacks[primaryModel] ?? DEFAULT_FALLBACKS)];
  const seen = new Set<string>();
  return chain.filter((id) => {
    const safe = sanitizeGeminiModelId(id);
    if (!safe || seen.has(safe)) return false;
    seen.add(safe);
    return true;
  });
}

export async function callGeminiWithModelFallback<T>(
  primaryModel: string,
  label: string,
  fn: (model: string) => Promise<T>,
  fallbacks: Record<string, string[]> = PLANNING_FALLBACKS,
  options?: { onSuccess?: (model: string, result: T) => void }
): Promise<T> {
  const models = buildModelChain(primaryModel, fallbacks);
  let lastError: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i]!;
    try {
      const result = await withRetry(() => fn(model), `${label} [${model}]`);
      options?.onSuccess?.(model, result);
      return result;
    } catch (err) {
      lastError = err;
      const next = models[i + 1];
      if (!next || !isGeminiTransientError(err)) throw err;
      console.warn(`${label}: ${model} indisponível — fallback para ${next}`);
      await sleep(1000);
    }
  }

  throw lastError;
}

export function callGeminiPlanning<T>(
  primaryModel: string,
  label: string,
  fn: (model: string) => Promise<T>,
  options?: { onSuccess?: (model: string, result: T) => void }
): Promise<T> {
  return callGeminiWithModelFallback(primaryModel, label, fn, PLANNING_FALLBACKS, options);
}

export function callGeminiIndexing<T>(
  primaryModel: string,
  label: string,
  fn: (model: string) => Promise<T>,
  options?: { onSuccess?: (model: string, result: T) => void }
): Promise<T> {
  return callGeminiWithModelFallback(primaryModel, label, fn, INDEXING_FALLBACKS, options);
}
