"use client";

import { useCallback, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { aiFetch } from "../lib/aiFetch";
import { aiQueue } from "../lib/aiQueue";
import { preparePostImageForAi } from "../lib/preparePostImageForAi";
import {
  buildCaptionCacheKey,
  getCachedCaption,
  getCachedCaptionAsync,
  setCachedCaption,
  setCachedCaptionAsync,
} from "../lib/captionCache";
import {
  finalizeCaption,
  extractMainCaptionText,
  resolveCatalogLabel,
  sanitizeRefinedCaptionOutput,
} from "../lib/captionFormat";
import { mergeRecentCaptionSignals } from "../lib/recentCaptionHooks";
import { isHookTooSimilar } from "../lib/captionSimilarity";
import { readJsonResponse } from "../lib/apiResponse";
import { getPendingCaptionPosts } from "../lib/captionBatch";
import { getReferenceCatalog } from "../lib/catalog";
import {
  pickCatalogReferenceFromCandidates,
  resolveKnownCatalogReference,
} from "../lib/catalogLabelMatch";
import {
  brandGemRequiredMessage,
  isBrandGemReadyForCaptions,
} from "../lib/brandGemValidation";
import { noteLastProviderUsed } from "../lib/aiSettingsStore";
import { isAbortError, catalogReadyForTextMatch } from "../lib/catalogEnrichment";
import { confirmDialog } from "../lib/confirmDialog";
import { promptDialog } from "../lib/promptDialog";
import { toast } from "../lib/toast";
import type {
  BrandGem,
  CatalogItem,
  CanvaGridPage,
  MatchDiagnostics,
  PlannedPost,
} from "../types";
import type { CaptionBatchProgress } from "../components/posts/CaptionBatchPanel";
import type { AppSection } from "../components/layout/AppSidebar";

type UseCaptionGenerationArgs = {
  posts: PlannedPost[];
  canvaPages: CanvaGridPage[];
  brandGem: BrandGem;
  catalogRef: MutableRefObject<CatalogItem[]>;
  postsRef: MutableRefObject<PlannedPost[]>;
  usesReferencesRef: MutableRefObject<boolean>;
  refineInstructions: Record<string, string>;
  getPostsSnapshot: () => PlannedPost[];
  setPosts: Dispatch<SetStateAction<PlannedPost[]>>;
  setIsProcessingAll: Dispatch<SetStateAction<boolean>>;
  setCaptionBatchProgress: Dispatch<SetStateAction<CaptionBatchProgress | null>>;
  setIsRefining: Dispatch<SetStateAction<Record<string, boolean>>>;
  setRefineInstructions: Dispatch<SetStateAction<Record<string, string>>>;
  isQuotaErrorMessage: (message: string) => boolean;
  ensureCatalogIndexedForMatch: () => Promise<boolean>;
  useApiStorage: boolean;
  activeClientId: string | null;
  saveWorkspaceNow: () => Promise<void>;
  handleNavigate: (section: AppSection) => void | Promise<void>;
};

function captionQueueLabel(postId: string, dayNumber: number): string {
  return `Legenda#${postId}#dia${dayNumber}`;
}

export function useCaptionGeneration({
  posts,
  canvaPages,
  brandGem,
  catalogRef,
  postsRef,
  usesReferencesRef,
  refineInstructions,
  getPostsSnapshot,
  setPosts,
  setIsProcessingAll,
  setCaptionBatchProgress,
  setIsRefining,
  setRefineInstructions,
  isQuotaErrorMessage,
  ensureCatalogIndexedForMatch,
  useApiStorage,
  activeClientId,
  saveWorkspaceNow,
  handleNavigate,
}: UseCaptionGenerationArgs) {
  const captionBatchAbortRef = useRef<AbortController | null>(null);
  const captionGenerateAbortRef = useRef<AbortController | null>(null);
  const batchCaptionHooksRef = useRef<string[]>([]);
  const captionGeneratePostIdRef = useRef<string | null>(null);
  const captionCacheBypassRef = useRef(new Set<string>());

  const stopCaptionGeneration = useCallback(
    (postId?: string) => {
      if (!postId || captionGeneratePostIdRef.current === postId) {
        captionGenerateAbortRef.current?.abort();
        captionGenerateAbortRef.current = null;
        captionGeneratePostIdRef.current = null;
      }
      if (postId) {
        aiQueue.cancelPending((label) => label.startsWith(`Legenda#${postId}#`));
      } else {
        aiQueue.cancelPending((label) => label.startsWith("Legenda#"));
      }
      setPosts((prev) =>
        prev.map((p) => {
          if (postId ? p.id === postId : p.isGenerating) {
            return { ...p, isGenerating: false, error: null };
          }
          return p;
        })
      );
    },
    [setPosts]
  );

  const ensureBrandGemConfigured = useCallback((): boolean => {
    if (isBrandGemReadyForCaptions(brandGem)) return true;
    toast.warning(brandGemRequiredMessage(brandGem));
    void handleNavigate("settings");
    return false;
  }, [brandGem, handleNavigate]);

  const resolvePostCatalogReferenceForCaption = useCallback(
    async (
      post: PlannedPost,
      refs: CatalogItem[],
      options?: { force?: boolean }
    ): Promise<
      | { status: "known"; id: string; label: string; source: string }
      | { status: "cancelled" }
      | { status: "none" }
    > => {
      let canvaLabel: string | null = null;
      if (post.canvaSlotRef) {
        const page = canvaPages.find((p) => p.id === post.canvaSlotRef!.pageId);
        const slot = page?.slots.find((s) => s.id === post.canvaSlotRef!.slotId);
        canvaLabel = slot?.label?.trim() || null;
      }
      const resolved = resolveKnownCatalogReference(
        refs.map((c) => ({ id: c.id, label: c.label })),
        {
          matchedCatalogId: post.matchedCatalogId,
          label: canvaLabel,
          forceFullMatch: !!options?.force && !post.matchedCatalogId,
        }
      );
      if (resolved.status === "known") {
        return {
          status: "known",
          id: resolved.item.id,
          label: resolved.item.label,
          source: resolved.source,
        };
      }
      if (resolved.status === "ambiguous") {
        const picked = await pickCatalogReferenceFromCandidates(resolved.candidates, promptDialog);
        if (!picked) return { status: "cancelled" };
        return { status: "known", id: picked.id, label: picked.label, source: "label" };
      }
      return { status: "none" };
    },
    [canvaPages]
  );

  const matchAndGenerateForPost = useCallback(
    async (
      postId: string,
      options?: {
        skipCatalogPrompt?: boolean;
        force?: boolean;
        skipCache?: boolean;
        signal?: AbortSignal;
      }
    ): Promise<{ quotaExceeded?: boolean }> => {
      const post = getPostsSnapshot().find((p) => p.id === postId);
      if (!post) return {};
      if (!post.image) {
        toast.warning("Carregue a foto do post antes de gerar a legenda.");
        return {};
      }
      if (!ensureBrandGemConfigured()) return {};
      if (post.isGenerating) return {};

      if (post.captionFromSchedule && post.caption.trim() && !options?.force) {
        const replaceOk = await confirmDialog({
          message:
            "Este dia já tem legenda vinda do Cronograma de Conteúdo. Gerar uma nova legenda com IA vai substituir esse texto. Continuar?",
          confirmLabel: "Substituir legenda",
        });
        if (!replaceOk) return {};
      }

      const recordBatchCaptionHook = (caption: string) => {
        const hook = extractMainCaptionText(caption, brandGem.footer).trim();
        if (!hook) return;
        if (batchCaptionHooksRef.current.some((h) => h.toLowerCase() === hook.toLowerCase())) {
          return;
        }
        batchCaptionHooksRef.current.push(hook);
      };

      const buildRecentHooks = (extraBatchHooks: string[] = []) =>
        mergeRecentCaptionSignals(
          getPostsSnapshot(),
          [...extraBatchHooks, ...batchCaptionHooksRef.current],
          postId,
          brandGem.footer,
          15
        );

      captionGenerateAbortRef.current?.abort();
      const controller = new AbortController();
      captionGenerateAbortRef.current = controller;
      captionGeneratePostIdRef.current = postId;
      const parentSignal = options?.signal;
      if (parentSignal?.aborted) {
        controller.abort();
      } else {
        parentSignal?.addEventListener("abort", () => controller.abort(), { once: true });
      }

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isGenerating: true,
                error: null,
                ...(options?.force ? { isGenerated: false, isConfirmed: false } : {}),
              }
            : p
        )
      );

      try {
        const imageOnly = !usesReferencesRef.current || !!post.captionFromImageOnly;
        const processedPostImage = await preparePostImageForAi(post.image, {
          maxSide: imageOnly ? 1280 : 2048,
          quality: imageOnly ? 0.88 : 0.9,
        });

        if (controller.signal.aborted) return {};

        if (!imageOnly && !options?.skipCatalogPrompt) {
          const ok = await ensureCatalogIndexedForMatch();
          if (!ok || controller.signal.aborted) {
            setPosts((prev) =>
              prev.map((p) => (p.id === postId ? { ...p, isGenerating: false } : p))
            );
            return {};
          }
        }

        if (controller.signal.aborted) return {};

        const refs = getReferenceCatalog(catalogRef.current);
        if (!imageOnly && refs.length > 0 && !catalogReadyForTextMatch(refs)) {
          toast.warning(
            "Todas as referências do catálogo precisam estar indexadas (JSON) antes de gerar a legenda."
          );
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isGenerating: false } : p)));
          return {};
        }

        let knownMatchedIdForRequest: string | undefined;
        if (!imageOnly) {
          const refResolution = await resolvePostCatalogReferenceForCaption(post, refs, {
            force: options?.force,
          });
          if (refResolution.status === "cancelled") {
            setPosts((prev) =>
              prev.map((p) => (p.id === postId ? { ...p, isGenerating: false } : p))
            );
            return {};
          }
          if (refResolution.status === "known") {
            knownMatchedIdForRequest = refResolution.id;
            if (post.matchedCatalogId !== refResolution.id) {
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === postId ? { ...p, matchedCatalogId: refResolution.id } : p
                )
              );
            }
            toast.info(`Referência ${refResolution.label} identificada — legenda sem match visual.`);
          }
        }

        let bypassCaptionCache =
          options?.force || options?.skipCache || captionCacheBypassRef.current.has(postId);
        if (knownMatchedIdForRequest) {
          bypassCaptionCache = true;
        }

        const extraAvoidHooks: string[] = [];
        if (options?.force && post.caption?.trim()) {
          const avoidHook = extractMainCaptionText(post.caption, brandGem.footer).trim();
          if (avoidHook) extraAvoidHooks.push(avoidHook);
        }

        let recentHooks = buildRecentHooks(extraAvoidHooks);
        const promptHooks = recentHooks.slice(-10).map((h) => h.slice(0, 140).trim());
        const isDiverseBatchLikely = promptHooks.length >= 3;
        if (isDiverseBatchLikely) {
          bypassCaptionCache = true;
        }
        const hookSignature = promptHooks
          .map((h) => h.toLowerCase())
          .slice(0, 6)
          .join("|");

        const buildRequestBody = (regenerate = false, hooks = promptHooks) => {
          const hooksForPrompt = hooks.slice(-10).map((h) => h.slice(0, 140).trim());
          const body: Record<string, unknown> = {
            postImage: processedPostImage,
            brandGem,
            ...(useApiStorage && activeClientId ? { clientId: activeClientId } : {}),
            ...(regenerate || options?.force || bypassCaptionCache
              ? { regenerateCaption: true }
              : {}),
            ...(imageOnly ? { captionFromImageOnly: true } : {}),
          };
          if (hooksForPrompt.length > 0) {
            body.recentHooks = hooksForPrompt;
            if (hooksForPrompt.length >= 3) {
              body.diverseBatch = true;
            }
          }
          if (!imageOnly && refs.length > 0) {
            body.catalogProfiles = refs.map((c) => ({
              id: c.id,
              label: c.label,
              profile: c.visualProfile,
            }));
          }
          if (knownMatchedIdForRequest) {
            body.knownMatchedId = knownMatchedIdForRequest;
          }
          return body;
        };

        let catalogIdsForCache: string[] = [];
        if (!imageOnly && refs.length > 0) {
          catalogIdsForCache = refs.map((c) => c.id);
        }

        const cacheKey = buildCaptionCacheKey({
          imageDataUrl: processedPostImage,
          postId,
          brandGem,
          catalogIds: catalogIdsForCache,
          captionFromImageOnly: imageOnly,
          hookSignature: isDiverseBatchLikely ? hookSignature : undefined,
        });

        const applyCaptionResult = async (
          caption: string,
          matchedId: string | null,
          reasoning: string | null,
          captionModel?: string | null,
          matchDiagnostics?: MatchDiagnostics | null
        ) => {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    matchedCatalogId: imageOnly
                      ? null
                      : usesReferencesRef.current
                        ? matchedId
                        : null,
                    reasoning: imageOnly || usesReferencesRef.current ? reasoning : null,
                    caption,
                    isGenerating: false,
                    isGenerated: true,
                    error: null,
                    captionFromSchedule: false,
                    captionModel: captionModel ?? null,
                    matchDiagnostics:
                      imageOnly || !usesReferencesRef.current ? null : (matchDiagnostics ?? null),
                  }
                : p
            )
          );
          recordBatchCaptionHook(caption);
          captionCacheBypassRef.current.delete(postId);
          await saveWorkspaceNow();
        };

        if (!bypassCaptionCache) {
          const cached = useApiStorage
            ? await getCachedCaptionAsync(cacheKey)
            : getCachedCaption(cacheKey);
          if (cached) {
            const cachedHook = extractMainCaptionText(cached.caption, brandGem.footer).trim();
            if (!cachedHook || !isHookTooSimilar(cachedHook, recentHooks)) {
              const effectiveMatchedId = imageOnly ? null : cached.matchedId;
              const cachedCaption = finalizeCaption(cached.caption, {
                matchedCatalogId: effectiveMatchedId,
                matchedLabel: imageOnly ? null : resolveCatalogLabel(refs, effectiveMatchedId),
                footer: brandGem.footer,
                captionParams: brandGem.captionParams,
              });
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === postId
                    ? {
                        ...p,
                        matchedCatalogId: imageOnly ? null : effectiveMatchedId,
                        reasoning: cached.reasoning,
                        caption: cachedCaption,
                        isGenerating: false,
                        isGenerated: true,
                        error: null,
                        captionModel: cached.modelUsed ?? null,
                      }
                    : p
                )
              );
              recordBatchCaptionHook(cachedCaption);
              await saveWorkspaceNow();
              return { quotaExceeded: false };
            }
          }
        }

        const callMatchAndGenerate = async (
          body: Record<string, unknown>
        ): Promise<{
          matchedId: string | null;
          reasoning: string | null;
          caption: string;
          providerUsed?: string;
          matchMode?: string;
          modelUsed?: string;
          matchDiagnostics?: MatchDiagnostics | null;
        }> => {
          const response = await aiQueue.enqueue(captionQueueLabel(postId, post.dayNumber), () =>
            aiFetch("/api/match-and-generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: controller.signal,
            })
          );

          if (controller.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          const result = await readJsonResponse<{
            matchedId?: string | null;
            reasoning?: string;
            caption?: string;
            error?: string;
            modelUsed?: string;
            matchDiagnostics?: MatchDiagnostics | null;
          }>(response);

          if (!response.ok) {
            throw new Error(result.error || "Falha ao gerar legenda no servidor.");
          }

          const providerUsed = response.headers.get("X-AI-Provider-Used") ?? undefined;
          noteLastProviderUsed(providerUsed);
          const matchMode = response.headers.get("X-AI-Match-Mode") ?? undefined;
          const modelUsed = result.modelUsed ?? response.headers.get("X-AI-Model-Used") ?? undefined;
          const matchedId = imageOnly ? null : (result.matchedId ?? null);
          const caption = finalizeCaption(result.caption ?? "", {
            matchedCatalogId: matchedId,
            matchedLabel: imageOnly ? null : resolveCatalogLabel(refs, matchedId),
            footer: brandGem.footer,
            captionParams: brandGem.captionParams,
          });

          return {
            matchedId,
            reasoning: result.reasoning ?? null,
            caption,
            providerUsed,
            matchMode,
            modelUsed,
            matchDiagnostics: result.matchDiagnostics ?? null,
          };
        };

        let body = buildRequestBody();
        let result = await callMatchAndGenerate(body);

        for (let attempt = 0; attempt < 2; attempt++) {
          const mainHook = extractMainCaptionText(result.caption, brandGem.footer).trim();
          if (!mainHook || !isHookTooSimilar(mainHook, recentHooks)) break;

          const retryHooks = mergeRecentCaptionSignals(
            getPostsSnapshot(),
            [mainHook, ...extraAvoidHooks, ...batchCaptionHooksRef.current],
            postId,
            brandGem.footer,
            15
          );
          recentHooks = retryHooks;
          body = buildRequestBody(true, retryHooks);
          result = await callMatchAndGenerate(body);
        }

        if (useApiStorage) {
          await setCachedCaptionAsync(cacheKey, {
            caption: result.caption,
            matchedId: result.matchedId,
            reasoning: result.reasoning,
            providerUsed: result.providerUsed,
            matchMode: result.matchMode,
            modelUsed: result.modelUsed,
            cachedAt: Date.now(),
          });
        } else {
          setCachedCaption(cacheKey, {
            caption: result.caption,
            matchedId: result.matchedId,
            reasoning: result.reasoning,
            providerUsed: result.providerUsed,
            matchMode: result.matchMode,
            modelUsed: result.modelUsed,
            cachedAt: Date.now(),
          });
        }

        await applyCaptionResult(
          result.caption,
          result.matchedId,
          result.reasoning,
          result.modelUsed,
          result.matchDiagnostics ?? null
        );
        return { quotaExceeded: false };
      } catch (error: unknown) {
        if (isAbortError(error) || captionGenerateAbortRef.current?.signal.aborted) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, isGenerating: false } : p)));
          return {};
        }
        console.error(error);
        const message = error instanceof Error ? error.message : "Falha na conexão com a API de IA.";
        const quotaExceeded = isQuotaErrorMessage(message);
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, isGenerating: false, error: message } : p))
        );
        return { quotaExceeded };
      } finally {
        if (captionGeneratePostIdRef.current === postId) {
          captionGenerateAbortRef.current = null;
          captionGeneratePostIdRef.current = null;
        }
      }
    },
    [
      activeClientId,
      brandGem,
      catalogRef,
      ensureBrandGemConfigured,
      ensureCatalogIndexedForMatch,
      getPostsSnapshot,
      isQuotaErrorMessage,
      resolvePostCatalogReferenceForCaption,
      saveWorkspaceNow,
      setPosts,
      useApiStorage,
      usesReferencesRef,
    ]
  );

  const stopCaptionBatch = useCallback(() => {
    captionBatchAbortRef.current?.abort();
    captionBatchAbortRef.current = null;
    stopCaptionGeneration();
    setIsProcessingAll(false);
    setCaptionBatchProgress(null);
  }, [setCaptionBatchProgress, setIsProcessingAll, stopCaptionGeneration]);

  const runCaptionBatch = useCallback(
    async (targets: PlannedPost[]) => {
      if (targets.length === 0) return;

      const ok = await ensureCatalogIndexedForMatch();
      if (!ok) return;

      captionBatchAbortRef.current?.abort();
      const controller = new AbortController();
      captionBatchAbortRef.current = controller;
      batchCaptionHooksRef.current = [];

      setIsProcessingAll(true);
      setCaptionBatchProgress({ current: 0, total: targets.length, label: "" });

      try {
        for (let i = 0; i < targets.length; i++) {
          if (controller.signal.aborted) break;

          const p = targets[i];
          setCaptionBatchProgress({
            current: i + 1,
            total: targets.length,
            label: `Dia ${p.dayNumber}`,
          });

          const { quotaExceeded } = await matchAndGenerateForPost(p.id, {
            skipCatalogPrompt: true,
            signal: controller.signal,
          });

          if (controller.signal.aborted) break;

          if (quotaExceeded) {
            toast.error(
              "Cota da API esgotada. A geração em lote foi interrompida. Tente mais tarde ou troque o provedor no painel IA (ícone ✨ no topo)."
            );
            break;
          }
        }
      } finally {
        if (captionBatchAbortRef.current === controller) {
          captionBatchAbortRef.current = null;
        }
        setIsProcessingAll(false);
        setCaptionBatchProgress(null);
        await saveWorkspaceNow();
      }
    },
    [
      ensureCatalogIndexedForMatch,
      matchAndGenerateForPost,
      saveWorkspaceNow,
      setCaptionBatchProgress,
      setIsProcessingAll,
    ]
  );

  const handleRunAllMatching = useCallback(async () => {
    if (!ensureBrandGemConfigured()) return;

    const pending = getPendingCaptionPosts(posts);
    if (pending.length === 0) {
      toast.info(
        "Não há posts com foto aguardando legenda. Carregue as imagens ou use “Tentar novamente” nos erros."
      );
      return;
    }

    if (pending.length >= 5) {
      const minutes = Math.max(1, Math.ceil((pending.length * 4) / 60));
      const ok = await confirmDialog({
        message:
          `Gerar ${pending.length} legendas em lote.\n\n` +
          `• Tempo estimado: ~${minutes} min (1 chamada por vez, gap de 1,5s)\n` +
          `• Cache local evita repetir fotos já processadas\n` +
          `• Se um provedor estourar a cota, a fila tenta o próximo automaticamente\n\n` +
          `Continuar?`,
        confirmLabel: "Gerar legendas",
      });
      if (!ok) return;
    }

    void runCaptionBatch(pending);
  }, [ensureBrandGemConfigured, posts, runCaptionBatch]);

  const handleRegenerateCaptionErrors = useCallback(() => {
    if (!ensureBrandGemConfigured()) return;

    const failed = posts.filter((p) => p.image && p.error && !p.isGenerating);
    if (failed.length === 0) return;
    void runCaptionBatch(failed);
  }, [ensureBrandGemConfigured, posts, runCaptionBatch]);

  const handleToggleCaptionFromImageOnly = useCallback(
    (postId: string, enabled: boolean) => {
      if (enabled) {
        captionCacheBypassRef.current.add(postId);
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                captionFromImageOnly: enabled,
                ...(enabled
                  ? {
                      matchedCatalogId: null,
                      caption: "",
                      reasoning: null,
                      isGenerated: false,
                      isConfirmed: false,
                      captionModel: null,
                    }
                  : {}),
              }
            : p
        )
      );
      if (enabled) {
        toast.info("Modo ativado. Clique em «Regenerar legenda» para ler o conteúdo da imagem.");
        void saveWorkspaceNow();
      }
    },
    [saveWorkspaceNow, setPosts]
  );

  const handleRefineCaption = useCallback(
    async (postId: string, instructionOverride?: string) => {
      const post = postsRef.current.find((p) => p.id === postId);
      const instructions = (instructionOverride ?? refineInstructions[postId] ?? "").trim();
      if (!post?.caption?.trim() || !instructions) return;
      if (!ensureBrandGemConfigured()) return;

      setIsRefining((prev) => ({ ...prev, [postId]: true }));

      try {
        const response = await aiFetch("/api/refine-caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentCaption: post.caption,
            instructions,
            brandGem,
            ...(useApiStorage && activeClientId ? { clientId: activeClientId } : {}),
          }),
        });

        const result = await readJsonResponse<{
          caption?: string;
          error?: string;
          modelUsed?: string;
        }>(response);
        if (!response.ok) {
          throw new Error(result.error || "Não foi possível refinar no servidor.");
        }

        noteLastProviderUsed(response.headers.get("X-AI-Provider-Used"));
        const captionModel =
          result.modelUsed ?? response.headers.get("X-AI-Model-Used") ?? post.captionModel ?? null;
        const refs = getReferenceCatalog(catalogRef.current);
        const caption = finalizeCaption(sanitizeRefinedCaptionOutput(result.caption ?? ""), {
          matchedCatalogId: post.matchedCatalogId,
          matchedLabel: resolveCatalogLabel(refs, post.matchedCatalogId),
          footer: brandGem.footer,
          captionParams: brandGem.captionParams,
        });

        if (!caption.trim()) {
          throw new Error("A IA devolveu uma legenda vazia. Tente outra instrução.");
        }

        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  caption,
                  isGenerated: true,
                  isConfirmed: false,
                  captionModel,
                }
              : p
          )
        );

        setRefineInstructions((prev) => ({ ...prev, [postId]: "" }));
        await saveWorkspaceNow();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error("Falha ao ajustar a legenda: " + message);
      } finally {
        setIsRefining((prev) => ({ ...prev, [postId]: false }));
      }
    },
    [
      brandGem,
      catalogRef,
      ensureBrandGemConfigured,
      postsRef,
      refineInstructions,
      saveWorkspaceNow,
      setIsRefining,
      setPosts,
      setRefineInstructions,
    ]
  );

  const markCaptionCacheBypass = useCallback((postId: string) => {
    captionCacheBypassRef.current.add(postId);
  }, []);

  return {
    stopCaptionGeneration,
    ensureBrandGemConfigured,
    resolvePostCatalogReferenceForCaption,
    matchAndGenerateForPost,
    stopCaptionBatch,
    runCaptionBatch,
    handleRunAllMatching,
    handleRegenerateCaptionErrors,
    handleToggleCaptionFromImageOnly,
    handleRefineCaption,
    markCaptionCacheBypass,
  };
}
