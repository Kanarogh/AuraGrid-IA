import { runVisionWithFallback } from "../ai/fallbackChain";
import { resetCatalogVisionBatchCache } from "../ai/openrouterModels";
import type { AiProviderId } from "../ai/types";
import {
  getCatalogItem,
  listCatalogItems,
  updateCatalogItem,
} from "./catalogService";
import { mediaAssetToDataUrl } from "./mediaService";

const ENRICH_DELAY_MS = 5000;
const ENRICH_RETRY_DELAY_MS = 5000;

const queues = new Map<string, { running: boolean; abort: AbortController | null }>();

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
  queues.set(queueKey(clientId), { running: false, abort: null });
}

export async function runCatalogEnrichment(
  clientId: string,
  itemIds?: string[],
  providerId?: AiProviderId
): Promise<{ quotaExceeded: boolean; cancelled: boolean }> {
  const key = queueKey(clientId);
  stopCatalogEnrichment(clientId);
  resetCatalogVisionBatchCache();
  const abort = new AbortController();
  queues.set(key, { running: true, abort });

  let quotaExceeded = false;
  try {
    const all = await listCatalogItems(clientId);
    const targets = itemIds?.length
      ? all.filter((c) => itemIds.includes(c.id) && c.isReference !== false)
      : all.filter(
          (c) =>
            c.isReference !== false &&
            (c.enrichmentStatus !== "ready" || !c.visualProfile)
        );

    for (let i = 0; i < targets.length; i++) {
      if (abort.signal.aborted) return { quotaExceeded, cancelled: true };
      const item = targets[i]!;
      if (!item.imageAssetId) continue;

      await updateCatalogItem(clientId, item.id, {
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
            providerId
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
              providerId
            );
            profile = outcome.result;
          } else {
            throw firstErr;
          }
        }

        await updateCatalogItem(clientId, item.id, {
          visualProfile: profile,
          enrichmentStatus: "ready",
          enrichedAt: new Date(),
          enrichmentError: null,
        });
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
    queues.set(key, { running: false, abort: null });
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
