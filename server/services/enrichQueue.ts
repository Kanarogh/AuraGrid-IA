import { getAiProviderId } from "../ai/config";
import { runVisionWithFallback } from "../ai/fallbackChain";
import { withUserAiContext } from "../ai/userAiContext";
import { ensureRuntimeAiSettingsLoaded } from "../ai/runtimeSettings";
import type { AiProviderId } from "../ai/types";
import { isMatchEmbeddingEnabled } from "../ai/matchConfig";
import { isPgvectorAvailable } from "../db/pgvector";
import { embedCatalogImage, isGeminiEmbeddingConfigured } from "../ai/geminiEmbeddings";
import {
  assessProfileReadiness,
  buildCatalogEmbeddingText,
  coerceCatalogProfile,
} from "../ai/catalogProfile";
import {
  getCatalogItem,
  listCatalogItems,
  resetStaleProcessingCatalogItems,
  updateCatalogEmbedding,
  updateCatalogItem,
} from "./catalogService";
import { mediaAssetToDataUrl } from "./mediaService";
import { ensureClientHasActivePeriod, getEffectiveUsesReferences } from "./planningPeriodService";
import { emitEnrichProgress } from "../sync/emitSyncEvent";
import {
  ENRICH_PHASE_LABELS,
  ENRICH_PHASE_PERCENT,
  type EnrichProgressPhase,
} from "@/src/lib/enrichProgressStages";
import { isJsonParseError } from "../ai/geminiJson";
import {
  clearEnrichJob,
  getPersistedEnrichProgress,
  isPersistedEnrichmentRunning,
  upsertEnrichJob,
} from "./enrichJobStore";

const ENRICH_DELAY_MS = 5000;
const ENRICH_RETRY_DELAY_MS = 5000;

export type EnrichProgress = {
  index: number;
  total: number;
  itemId: string;
  label: string;
  phase?: EnrichProgressPhase;
  itemPercent?: number;
  stepLabel?: string;
};

const queues = new Map<
  string,
  { running: boolean; abort: AbortController | null; progress: EnrichProgress | null }
>();

function queueKey(clientId: string) {
  return clientId;
}

function formatEnrichmentError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const line = msg.split("\n")[0]?.trim() ?? msg;
  if (/JSON inválido|Unterminated string/i.test(line)) {
    return "Resposta JSON inválida do Gemini (truncada ou corrompida). Use “Tentar de novo”.";
  }
  return line.length > 280 ? `${line.slice(0, 277)}…` : line;
}

function isTransientError(message: string): boolean {
  return (
    /503|UNAVAILABLE|high demand|overloaded|try again later/i.test(message) ||
    isJsonParseError(new Error(message))
  );
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
  void upsertEnrichJob(clientId, { status: "cancelled", progress: null }).then(() =>
    clearEnrichJob(clientId)
  );
}

export function getEnrichmentProgress(clientId: string): EnrichProgress | null {
  return queues.get(queueKey(clientId))?.progress ?? null;
}

export async function getEnrichmentProgressResolved(
  clientId: string
): Promise<EnrichProgress | null> {
  const inMemory = getEnrichmentProgress(clientId);
  if (inMemory) return inMemory;
  return getPersistedEnrichProgress(clientId);
}

export async function runCatalogEnrichment(
  clientId: string,
  itemIds?: string[],
  providerId?: AiProviderId,
  userId?: string
): Promise<{ quotaExceeded: boolean; cancelled: boolean }> {
  const execute = () => runCatalogEnrichmentInner(clientId, itemIds, providerId, userId);
  if (userId) return withUserAiContext(userId, execute);
  return execute();
}

async function runCatalogEnrichmentInner(
  clientId: string,
  itemIds?: string[],
  providerId?: AiProviderId,
  userId?: string
): Promise<{ quotaExceeded: boolean; cancelled: boolean }> {
  const key = queueKey(clientId);
  stopCatalogEnrichment(clientId);
  const abort = new AbortController();
  queues.set(key, { running: true, abort, progress: null });
  void upsertEnrichJob(clientId, {
    userId,
    itemIds,
    status: "running",
    progress: null,
  });

  let quotaExceeded = false;
  let periodId: string | undefined;
  try {
    if (userId) {
      periodId = await ensureClientHasActivePeriod(clientId);
      void emitEnrichProgress(userId, clientId, periodId, true);
    }
    const usesReferences = await getEffectiveUsesReferences(clientId, periodId);
    if (!usesReferences) {
      console.info(`[enrich] ignorado â€” roteiro sem referÃªncias (clientId=${clientId})`);
      if (userId && periodId) {
        void emitEnrichProgress(userId, clientId, periodId, false);
      }
      return { quotaExceeded: false, cancelled: false };
    }
    await ensureRuntimeAiSettingsLoaded();
    try {
      await resetStaleProcessingCatalogItems(clientId);
    } catch (err) {
      console.warn(
        "[enrich] reset de processing Ã³rfÃ£o ignorado:",
        err instanceof Error ? err.message : err
      );
    }
    const activeProvider = providerId ?? getAiProviderId();
    console.info(`[enrich] provedor=${activeProvider} (indexaÃ§Ã£o JSON)`);

    const all = await listCatalogItems(clientId);

    const pushProgress = (
      item: { id: string; label: string },
      imageIndex: number,
      total: number,
      phase: EnrichProgressPhase,
      itemPercent?: number
    ) => {
      const progress: EnrichProgress = {
        index: imageIndex,
        total,
        itemId: item.id,
        label: item.label,
        phase,
        itemPercent: itemPercent ?? ENRICH_PHASE_PERCENT[phase],
        stepLabel: ENRICH_PHASE_LABELS[phase],
      };
      queues.set(key, { running: true, abort, progress });
      void upsertEnrichJob(clientId, {
        userId,
        itemIds,
        status: "running",
        progress,
      });
      if (userId) {
        void emitEnrichProgress(userId, clientId, periodId, true, progress);
      }
    };
    const targets = itemIds?.length
      ? all.filter((c) => itemIds.includes(c.id) && c.isReference !== false)
      : all.filter(
          (c) =>
            c.isReference !== false &&
            ((c.enrichmentStatus !== "ready" &&
              c.enrichmentStatus !== "ready_limited") ||
              !c.visualProfile)
        );

    const withImage = targets.filter((c) => c.imageAssetId);
    const total = withImage.length;

    for (let i = 0; i < targets.length; i++) {
      if (abort.signal.aborted) return { quotaExceeded, cancelled: true };
      const item = targets[i]!;
      if (!item.imageAssetId) continue;

      const imageIndex = withImage.findIndex((c) => c.id === item.id) + 1;
      pushProgress(item, imageIndex, total, "prepare");

      await updateCatalogItem(clientId, item.id, {
        visualProfile: null,
        enrichmentStatus: "processing",
        enrichmentError: null,
      });

      try {
        pushProgress(item, imageIndex, total, "download", 8);
        const image = await mediaAssetToDataUrl(item.imageAssetId);
        pushProgress(item, imageIndex, total, "download", 14);
        const siblingCandidates = all
          .filter(
            (c) =>
              c.id !== item.id &&
              c.visualProfile &&
              (c.enrichmentStatus === "ready" ||
                c.enrichmentStatus === "ready_limited")
          )
          .map((c) => ({
            id: c.id,
            label: c.label,
            profile: c.visualProfile as Record<string, unknown>,
          }));

        const enrichInput = {
          image,
          label: item.label,
          id: item.id,
          siblingCandidates,
          onProgress: (step: { phase: string; itemPercent: number; stepLabel?: string }) => {
            pushProgress(
              item,
              imageIndex,
              total,
              step.phase as EnrichProgressPhase,
              step.itemPercent
            );
          },
        };

        pushProgress(item, imageIndex, total, "analyze", 18);
        let profile;
        try {
          const outcome = await runVisionWithFallback(
            "enrich-catalog-item",
            (provider) => provider.enrichCatalogItem(enrichInput),
            activeProvider
          );
          profile = outcome.result;
        } catch (firstErr) {
          const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
          if (isQuotaError(msg)) {
            quotaExceeded = true;
            await updateCatalogItem(clientId, item.id, {
              enrichmentStatus: "failed",
              enrichmentError: formatEnrichmentError(firstErr),
            });
            return { quotaExceeded, cancelled: false };
          }
          if (isTransientError(msg)) {
            await sleep(ENRICH_RETRY_DELAY_MS, abort.signal);
            const outcome = await runVisionWithFallback(
              "enrich-catalog-item",
              (provider) => provider.enrichCatalogItem(enrichInput),
              activeProvider
            );
            profile = outcome.result;
          } else {
            throw firstErr;
          }
        }

        if (abort.signal.aborted) return { quotaExceeded, cancelled: true };

        pushProgress(item, imageIndex, total, "save", 86);
        const coerced = coerceCatalogProfile(
          profile as Record<string, unknown>,
          item.label
        );
        const enrichmentStatus = assessProfileReadiness(coerced);

        await updateCatalogItem(clientId, item.id, {
          visualProfile: profile,
          enrichmentStatus,
          enrichedAt: new Date(),
          enrichmentError: null,
        });
        pushProgress(item, imageIndex, total, "save", 90);

        if (
          isMatchEmbeddingEnabled() &&
          isGeminiEmbeddingConfigured() &&
          (await isPgvectorAvailable())
        ) {
          try {
            pushProgress(item, imageIndex, total, "embed", 92);
            const profileText = buildCatalogEmbeddingText(coerced);
            const vector = await embedCatalogImage(image, profileText);
            await updateCatalogEmbedding(clientId, item.id, vector);
            pushProgress(item, imageIndex, total, "embed", 98);
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

        pushProgress(item, imageIndex, total, "done", 100);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await updateCatalogItem(clientId, item.id, {
          enrichmentStatus: "failed",
          enrichmentError: formatEnrichmentError(err),
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
    void clearEnrichJob(clientId);
    if (userId) {
      void emitEnrichProgress(userId, clientId, periodId, false);
    }
  }
}

export function isEnrichmentRunning(clientId: string): boolean {
  return queues.get(queueKey(clientId))?.running ?? false;
}

export async function isEnrichmentRunningResolved(clientId: string): Promise<boolean> {
  if (isEnrichmentRunning(clientId)) return true;
  return isPersistedEnrichmentRunning(clientId);
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

