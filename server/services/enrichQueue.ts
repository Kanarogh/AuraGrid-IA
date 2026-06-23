import { getAiProviderId } from "../ai/config";
import { runVisionWithFallback } from "../ai/fallbackChain";
import { withUserAiContext } from "../ai/userAiContext";
import { ensureRuntimeAiSettingsLoaded } from "../ai/runtimeSettings";
import { resetCatalogVisionBatchCache } from "../ai/openrouterModels";
import type { AiProviderId } from "../ai/types";
import { isMatchEmbeddingEnabled } from "../ai/matchConfig";
import { isPgvectorAvailable } from "../db/pgvector";
import { embedCatalogImage, isGeminiEmbeddingConfigured } from "../ai/geminiEmbeddings";
import {
  getCatalogItem,
  listCatalogItems,
  resetStaleProcessingCatalogItems,
  updateCatalogEmbedding,
  updateCatalogItem,
} from "./catalogService";
import { mediaAssetToDataUrl } from "./mediaService";

const ENRICH_DELAY_MS = 5000;
const ENRICH_RETRY_DELAY_MS = 5000;

export type EnrichProgress = {
  index: number;
  total: number;
  itemId: string;
  label: string;
};

const queues = new Map<
  string,
  { running: boolean; abort: AbortController | null; progress: EnrichProgress | null }
>();

function queueKey(clientId: string) {
  return clientId;
}

function isTransientError(message: string): boolean {
  return /503|UNAVAILABLE|high demand|overloaded|try again later/i.test(message);
}

function isQuotaError(message: string): boolean {
  return /429|cota|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(message);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}

export function stopCatalogEnrichment(clientId: string) {
  const q = queues.get(queueKey(clientId));
  if (q?.abort) q.abort.abort();
  queues.set(queueKey(clientId), { running: false, abort: null, progress: null });
}

export function getEnrichmentProgress(clientId: string): EnrichProgress | null {
  return queues.get(queueKey(clientId))?.progress ?? null;
}

export async function runCatalogEnrichment(
  clientId: string,
  itemIds?: string[],
  providerId?: AiProviderId,
  userId?: string
): Promise<{ quotaExceeded: boolean; cancelled: boolean }> {
  const execute = () => runCatalogEnrichmentInner(clientId, itemIds, providerId);
  if (userId) return withUserAiContext(userId, execute);
  return execute();
}

async function runCatalogEnrichmentInner(
  clientId: string,
  itemIds?: string[],
  providerId?: AiProviderId
): Promise<{ quotaExceeded: boolean; cancelled: boolean }> {
  const key = queueKey(clientId);
  stopCatalogEnrichment(clientId);
  resetCatalogVisionBatchCache();
  const abort = new AbortController();
  queues.set(key, { running: true, abort, progress: null });

  let quotaExceeded = false;
  try {
    await ensureRuntimeAiSettingsLoaded();
    await resetStaleProcessingCatalogItems(clientId);
    const activeProvider = providerId ?? getAiProviderId();
    console.info(`[enrich] provedor=${activeProvider} (indexação JSON)`);

    const all = await listCatalogItems(clientId);
    const targets = itemIds?.length
      ? all.filter((c) => itemIds.includes(c.id) && c.isReference !== false)
      : all.filter(
          (c) =>
            c.isReference !== false &&
            (c.enrichmentStatus !== "ready" || !c.visualProfile)
        );

    const withImage = targets.filter((c) => c.imageAssetId);
    const total = withImage.length;

    for (let i = 0; i < targets.length; i++) {
      if (abort.signal.aborted) return { quotaExceeded, cancelled: true };
      const item = targets[i]!;
      if (!item.imageAssetId) continue;

      const imageIndex = withImage.findIndex((c) => c.id === item.id) + 1;
      queues.set(key, {
        running: true,
        abort,
        progress: {
          index: imageIndex,
          total,
          itemId: item.id,
          label: item.label,
        },
      });

      await updateCatalogItem(clientId, item.id, {
        visualProfile: null,
        enrichmentStatus: "processing",
        enrichmentError: null,
      });

      try {
        const image = await mediaAssetToDataUrl(item.imageAssetId);
        let profile;
        try {
          const outcome = await runVisionWithFallback(
            "enrich-catalog-item",
            (provider) => provider.enrichCatalogItem({ image, label: item.label, id: item.id }),
            activeProvider
          );
          profile = outcome.result;
        } catch (firstErr) {
          const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
          if (isQuotaError(msg)) {
            quotaExceeded = true;
            await updateCatalogItem(clientId, item.id, {
              enrichmentStatus: "failed",
              enrichmentError: msg,
            });
            return { quotaExceeded, cancelled: false };
          }
          if (isTransientError(msg)) {
            await sleep(ENRICH_RETRY_DELAY_MS, abort.signal);
            const outcome = await runVisionWithFallback(
              "enrich-catalog-item",
              (provider) => provider.enrichCatalogItem({ image, label: item.label, id: item.id }),
              activeProvider
            );
            profile = outcome.result;
          } else {
            throw firstErr;
          }
        }

        if (abort.signal.aborted) return { quotaExceeded, cancelled: true };

        await updateCatalogItem(clientId, item.id, {
          visualProfile: profile,
          enrichmentStatus: "ready",
          enrichedAt: new Date(),
          enrichmentError: null,
        });

        if (
          isMatchEmbeddingEnabled() &&
          isGeminiEmbeddingConfigured() &&
          (await isPgvectorAvailable())
        ) {
          try {
            const vector = await embedCatalogImage(image);
            await updateCatalogEmbedding(clientId, item.id, vector);
            console.info(`[enrich] embedding ok para ${item.id} (${vector.length}d)`);
          } catch (embedErr) {
            console.warn(
              `[enrich] embedding falhou para ${item.id}:`,
              embedErr instanceof Error ? embedErr.message : embedErr
            );
          }
        } else if (isMatchEmbeddingEnabled()) {
          console.warn(`[enrich] embedding ignorado — GEMINI_API_KEY ausente (${item.id})`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateCatalogItem(clientId, item.id, {
          enrichmentStatus: "failed",
          enrichmentError: msg,
        });
        if (isQuotaError(msg)) {
          quotaExceeded = true;
          return { quotaExceeded, cancelled: false };
        }
      }

      if (i < targets.length - 1) {
        await sleep(ENRICH_DELAY_MS, abort.signal);
      }
    }
    return { quotaExceeded, cancelled: abort.signal.aborted };
  } finally {
    queues.set(key, { running: false, abort: null, progress: null });
  }
}

export function isEnrichmentRunning(clientId: string): boolean {
  return queues.get(queueKey(clientId))?.running ?? false;
}

export async function enrichSingleCatalogItem(
  clientId: string,
  itemId: string,
  providerId?: AiProviderId
) {
  return runCatalogEnrichment(clientId, [itemId], providerId);
}

export async function getCatalogItemForEnrich(clientId: string, itemId: string) {
  return getCatalogItem(clientId, itemId);
}
