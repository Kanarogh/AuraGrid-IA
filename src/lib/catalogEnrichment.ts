import { normalizeVisualProfile } from "./catalog";
import type { CatalogItem, CatalogVisualProfile } from "../types";
import { readJsonResponse } from "./apiResponse";
import { aiFetch } from "./aiFetch";
import { getState as getAiSettingsState } from "./aiSettingsStore";
import { aiQueue } from "./aiQueue";
import { resizeForAi, convertSvgToDataUrl } from "./images";

const ENRICH_DELAY_MS = 2500;
const ENRICH_DELAY_OPENROUTER_MS = 8000;
/** Evita ficar minutos esperando retry do servidor quando a cota já estourou */
const ENRICH_FETCH_TIMEOUT_MS = 45_000;

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

function isQuotaError(message: string): boolean {
  return /429|cota|quota|RESOURCE_EXHAUSTED|rate.?limit|tokens per day|TPD|limite diário|esgotad|todos os modelos de visão falharam|resumo das tentativas/i.test(
    message
  );
}

function mergeAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const active = signals.filter((s): s is AbortSignal => !!s);
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const s of active) {
    if (s.aborted) {
      controller.abort();
      return controller.signal;
    }
    s.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
}

export async function enrichCatalogItemOnServer(
  item: Pick<CatalogItem, "id" | "label" | "image">,
  signal?: AbortSignal
): Promise<CatalogVisualProfile> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), ENRICH_FETCH_TIMEOUT_MS);
  const requestSignal = mergeAbortSignals(signal, timeoutController.signal);

  try {
    const converted = await convertSvgToDataUrl(item.image);
    const compressedImage = await resizeForAi(converted, { maxSide: 768 });

    const response = await aiQueue.enqueue(
      `Indexar ${item.label || item.id}`,
      () =>
        aiFetch("/api/enrich-catalog-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.id,
            label: item.label,
            image: compressedImage,
          }),
          signal: requestSignal,
        })
    );

    const data = await readJsonResponse<{ profile?: CatalogVisualProfile; error?: string }>(
      response
    );
    if (!response.ok) {
      throw new Error(data.error || "Falha ao indexar referência.");
    }
    if (!data.profile) {
      throw new Error("Servidor não retornou o perfil JSON. Tente reiniciar com npm run dev.");
    }
    return normalizeVisualProfile(data.profile, item.label);
  } catch (err) {
    if (timeoutController.signal.aborted && !signal?.aborted) {
      throw new Error(
        "Tempo esgotado aguardando o servidor (45s). Use Parar indexação ou verifique a cota Gemini."
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type EnrichQueueResult = { cancelled: boolean; quotaExceeded: boolean };

/** Indexa referências em fila (evita estourar cota por minuto) */
function enrichDelayMs(): number {
  const provider = getAiSettingsState().settings?.activeProvider;
  return provider === "openrouter" ? ENRICH_DELAY_OPENROUTER_MS : ENRICH_DELAY_MS;
}

export async function enrichCatalogItemsInQueue(
  items: CatalogItem[],
  onItemStart?: (id: string) => void,
  onItemDone?: (id: string, profile: CatalogVisualProfile) => void,
  onItemFailed?: (id: string, error: string) => void,
  options?: { signal?: AbortSignal }
): Promise<EnrichQueueResult> {
  const signal = options?.signal;
  let quotaExceeded = false;

  for (let i = 0; i < items.length; i++) {
    if (signal?.aborted) return { cancelled: true, quotaExceeded };

    const item = items[i];
    if (item.enrichmentStatus === "ready" && item.visualProfile) continue;

    onItemStart?.(item.id);
    try {
      const profile = await enrichCatalogItemOnServer(item, signal);
      if (signal?.aborted) return { cancelled: true, quotaExceeded };
      onItemDone?.(item.id, profile);
    } catch (err) {
      if (signal?.aborted || isAbortError(err)) {
        return { cancelled: true, quotaExceeded };
      }
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      onItemFailed?.(item.id, message);
      if (isQuotaError(message)) {
        quotaExceeded = true;
        return { cancelled: false, quotaExceeded: true };
      }
    }

    if (signal?.aborted) return { cancelled: true, quotaExceeded };

    if (i < items.length - 1) {
      await sleep(enrichDelayMs(), signal);
      if (signal?.aborted) return { cancelled: true, quotaExceeded };
    }
  }

  return { cancelled: false, quotaExceeded };
}

export function catalogReadyForTextMatch(items: CatalogItem[]): boolean {
  if (items.length === 0) return false;
  return items.every((c) => c.enrichmentStatus === "ready" && c.visualProfile);
}
