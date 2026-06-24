"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Sparkles,
  Copy,
  Trash2,
  Upload,
  RefreshCw,
  FileText,
  Check,
  Plus,
  Eye,
  ShoppingBag,
  Sliders,
  CheckCircle,
  Grid,
  CheckCircle2,
  CalendarDays,
  ExternalLink,
  MapPin,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  FolderOpen,
  Image as ImageIcon,
  CheckCheck,
  ChevronRight,
  ArrowRight,
  LayoutGrid,
  X,
  RotateCcw,
  Square,
  Eraser,
  ZoomIn,
  ZoomOut,
  FileDown,
  Loader2,
} from "lucide-react";
import { PRELOADED_CATALOG } from "./data/preloaded";
import {
  CatalogItem,
  CatalogVisualProfile,
  PlannedPost,
  CanvaGridPage,
  CanvaGridSlot,
} from "./types";
import { isAbortError, catalogReadyForTextMatch } from "./lib/catalogEnrichment";
import { useClientWorkspace } from "./context/ClientWorkspaceContext";
import {
  clearCatalogApi,
  clearCatalogEnrichmentsApi,
  clearGridCatalogApi,
  deleteCatalogItemApi,
  enrichCatalogApi,
  fetchWorkspace,
  stopEnrichCatalogApi,
  uploadMediaApi,
  apiWorkspaceToClientWorkspace,
  fetchImageAsDataUrl,
  resolveCatalogItemImage,
  resolveMediaUrl,
} from "./lib/api/workspaceApi";
import { exportRoteiroPdf } from "./lib/exportRoteiroPdf";
import { exportCanvaGridPdf } from "./lib/exportCanvaGridPdf";
import { ensurePersistedImage, extractMediaAssetId } from "./lib/api/persistMedia";
import { recalculatePostDates } from "./lib/dates";
import { createEmptyCanvaPage, prependCanvaPage, renumberCanvaPages, resolveActiveCanvaPage, resolveSlotImage } from "./lib/canva";
import { getPostStatus } from "./lib/postStatus";

function captionQueueLabel(postId: string, dayNumber: number): string {
  return `Legenda#${postId}#dia${dayNumber}`;
}
import { useTheme } from "./hooks/useTheme";
import { useAppRouteSync, type AppRouteSyncHandlers } from "./hooks/useAppRouteSync";
import type { SettingsTab } from "./lib/appRouting";
import { useAppNavigation, buildDashboardPath } from "./lib/appRouting";
import { useRouter } from "next/navigation";
import { DashboardView } from "./components/dashboard/DashboardView";
import { useDashboardMetrics } from "./hooks/useDashboardMetrics";
import { useAuth } from "./context/AuthContext";
import { aiFetch } from "./lib/aiFetch";
import {
  initAiSettingsStore,
  noteLastProviderUsed,
  refreshAiSettings,
} from "./lib/aiSettingsStore";
import { useAiSettings } from "./hooks/useAiSettings";
import { resizeImage, convertSvgToDataUrl, resizeForAi, fileToCatalogImageDataUrl } from "./lib/images";
import { aiQueue } from "./lib/aiQueue";
import {
  buildCaptionCacheKey,
  getCachedCaption,
  getCachedCaptionAsync,
  removeCachedCaptionAsync,
  setCachedCaption,
  setCachedCaptionAsync,
} from "./lib/captionCache";
import { preparePostImageForAi } from "./lib/preparePostImageForAi";
import { finalizeCaption, extractMainCaptionText, resolveCatalogLabel, sanitizeRefinedCaptionOutput } from "./lib/captionFormat";
import { normalizeCaptionGenerationParams } from "./lib/captionParams";
import {
  syncCanvaPagesToPosts,
  scheduleItemsToPosts,
  canvaSlotsToScheduleItems,
  type ScheduleItem,
} from "./lib/canvaTimelineSync";
import {
  DEFAULT_DISTRIBUTION_PREFS,
  buildDistributionPreview,
  type DistributionPrefs,
} from "./lib/smartDistribution";
import { AppShell } from "./components/layout/AppShell";
import type { AppSection } from "./components/layout/AppSidebar";
import { Footer } from "./components/layout/Footer";
import { ApiAlert } from "./components/shared/ApiAlert";
import { ConfigPanel } from "./components/shared/ConfigPanel";
import { SchedulerPanel } from "./components/shared/SchedulerPanel";
import { TimelineStrip } from "./components/shared/TimelineStrip";
import {
  CaptionBatchPanel,
  type CaptionBatchProgress,
} from "./components/posts/CaptionBatchPanel";
import { PostDayStudio } from "./components/posts/PostDayStudio";
import { EditorialGridView } from "./components/posts/EditorialGridView";
import { PostsWorkspaceToolbar, type PostsWorkTab } from "./components/posts/PostsWorkspaceToolbar";
import { PopularCalendarioPanel } from "./components/posts/PopularCalendarioPanel";
import { PostsWorkflowBar } from "./components/posts/PostsWorkflowBar";
import {
  PlanningPeriodReadOnlyBanner,
  PlanningPeriodSelector,
} from "./components/posts/PlanningPeriodSelector";
import { NewPlanningPeriodModal } from "./components/posts/NewPlanningPeriodModal";
import { StudioSection } from "./components/ui/StudioSection";
import { Button } from "./components/ui/Button";
import { CatalogThumbnail } from "./components/ui/CatalogThumbnail";
import { EmptyState } from "./components/ui/EmptyState";
import { FeedInstagramPreview } from "./components/feed/FeedInstagramPreview";
import { getCaptionBatchStats, getPendingCaptionPosts } from "./lib/captionBatch";
import { mergeRecentCaptionSignals } from "./lib/recentCaptionHooks";
import { isHookTooSimilar } from "./lib/captionSimilarity";
import { readJsonResponse } from "./lib/apiResponse";
import { CatalogTabNav } from "./components/catalog/CatalogTabNav";
import { CatalogModal } from "./components/catalog/CatalogModal";
import { CatalogProfileModal } from "./components/catalog/CatalogProfileModal";
import { ReferenceFinderPanel } from "./components/reference/ReferenceFinderPanel";
import {
  CanvaTimelineSyncPanel,
  CanvaGridOrderHint,
} from "./components/canva/CanvaTimelineSyncPanel";
import { CanvaGridLightbox } from "./components/canva/CanvaGridLightbox";
import { CanvaGridWorkspace } from "./components/canva/CanvaGridWorkspace";
import { getCanvaGridFormat } from "./lib/canvaGridFormats";
import {
  CATALOG_DRAG_MIME,
  getImageFileFromClipboard,
  getImageFileFromDataTransfer,
} from "./lib/clipboardImage";
import {
  clearCatalogEnrichmentPatch,
  getCanvaCatalog,
  getGridCatalog,
  getReferenceCatalog,
  hasCatalogEnrichmentData,
  isAutoImportedCatalogItem,
  isCatalogItemIndexed,
  isReferenceCatalogItem,
  normalizeCatalogItem,
  prepareCatalogItemForEnrichment,
} from "./lib/catalog";
import {
  brandGemRequiredMessage,
  formatMissingBrandGemFields,
  getMissingBrandGemFields,
  isBrandGemReadyForCaptions,
} from "./lib/brandGemValidation";
import { toast } from "./lib/toast";
import { confirmDialog } from "./lib/confirmDialog";
import {
  collectFilesFromDataTransfer,
  enableFolderPickerInput,
  pickFilesFromFolder,
  prepareCatalogUploadCandidates,
} from "./lib/catalogImageUpload";
import {
  createInitialUploadProgress,
  uploadCatalogCandidatesSequential,
  type CatalogUploadProgressState,
} from "./lib/catalogUploadProgress";
import {
  computeOverallUploadPercent,
  estimateUploadEtaSeconds,
} from "./lib/uploadProgress";
import { useCatalogEnrichmentWatcher } from "./hooks/useCatalogEnrichmentWatcher";
import { useRemoteSyncCoordinator } from "./hooks/useRemoteSyncCoordinator";
import {
  beginSyncDomain,
  endSyncDomain,
} from "./lib/sync/mutationGuard";
import { SYNC_DOMAIN_LABELS } from "./lib/sync/types";
import { CatalogEnrichProgressPanel } from "./components/catalog/CatalogEnrichProgressPanel";
import { CatalogUploadProgressPanel } from "./components/catalog/CatalogUploadProgressPanel";


export default function App() {
  const { isDark, toggleTheme } = useTheme();
  const { user: authUser, storageMode } = useAuth();

  const {
    hasActiveClient,
    activeClientId,
    effectiveActiveClientId,
    activeClient,
    clients,
    workspace,
    setCatalog,
    setPosts,
    setStartDate,
    setBrandGem,
    saveBrandGem,
    setCanvaPages,
    setActiveCanvaPageId,
    setAutoSyncCanva,
    setCanvaGridReversed,
    setCanvaGridFormat,
    setCanvaGridMaxWidth,
    setUiPrefs,
    resetActiveClient,
    useApiStorage,
    persistWorkspaceNow,
    getPostsSnapshot,
    workspaceHydrated,
    activePlanningPeriodId,
    planningPeriods,
    isReadOnly,
    switchPlanningPeriod,
    createPlanningPeriod,
    duplicatePlanningPeriod,
    switchClient,
    applyRemoteRegistry,
    applyRemotePlanningPeriods,
  } = useClientWorkspace();

  const activeClientIdRef = useRef(activeClientId);
  activeClientIdRef.current = activeClientId;

  const saveWorkspaceNow = useCallback(async () => {
    try {
      await persistWorkspaceNow();
    } catch {
      /* toast em persistWorkspaceNow */
    }
  }, [persistWorkspaceNow]);

  const catalog = workspace.catalog;
  const posts = workspace.posts;
  const startDate = workspace.startDate;
  const brandGem = workspace.brandGem;
  const activePeriodLabel =
    planningPeriods.find((p) => p.id === activePlanningPeriodId)?.label ?? "Roteiro";
  const brandGemReady = useMemo(() => isBrandGemReadyForCaptions(brandGem), [brandGem]);
  const brandGemMissingFields = useMemo(
    () => formatMissingBrandGemFields(brandGem),
    [brandGem]
  );
  const brandGemMissingCount = useMemo(
    () => getMissingBrandGemFields(brandGem).length,
    [brandGem]
  );
  const captionGenerationParams = useMemo(
    () => normalizeCaptionGenerationParams(brandGem.captionParams),
    [brandGem.captionParams]
  );
  const canvaPages = workspace.canva.pages;
  const activeCanvaPageId = workspace.canva.activePageId;
  const autoSyncCanva = workspace.canva.autoSync;
  const canvaGridReversed = workspace.canva.reversed;
  const canvaGridFormat = workspace.canva.gridFormat ?? "square";
  const canvaGridFormatMeta = useMemo(
    () => getCanvaGridFormat(canvaGridFormat),
    [canvaGridFormat]
  );
  const canvaGridMaxWidth =
    workspace.canva.gridMaxWidth ?? canvaGridFormatMeta.defaultMaxWidth;

  /** Guarda-roupa: só referências enviadas na aba Catálogo (pasta/arquivo único) */
  const referenceCatalog = useMemo(
    () =>
      getReferenceCatalog(catalog).map((item) => ({
        ...item,
        image: resolveCatalogItemImage(item) ?? item.image,
      })),
    [catalog, authUser?.id]
  );

  const gridCatalog = useMemo(
    () =>
      getGridCatalog(catalog).map((item) => ({
        ...item,
        image: resolveCatalogItemImage(item) ?? item.image,
      })),
    [catalog, authUser?.id]
  );

  const canvaCatalog = useMemo(
    () =>
      getCanvaCatalog(catalog).map((item) => ({
        ...item,
        image: resolveCatalogItemImage(item) ?? item.image,
      })),
    [catalog, authUser?.id]
  );

  // Remove importações automáticas legadas do Canva/calendário (não peças de grid do usuário)
  useEffect(() => {
    setCatalog((prev) => {
      const cleaned = prev.filter((item) => !isAutoImportedCatalogItem(item));
      return cleaned.length === prev.length ? prev : cleaned;
    });
  }, [setCatalog]);

  // Indexação interrompida no modo local — no cloud o status vem do servidor
  useEffect(() => {
    if (useApiStorage) return;
    setCatalog((prev) => {
      const hasStuck = prev.some((c) => c.enrichmentStatus === "processing");
      if (!hasStuck) return prev;
      return prev.map((c) =>
        c.enrichmentStatus === "processing"
          ? { ...c, enrichmentStatus: "pending" as const, enrichmentError: undefined }
          : c
      );
    });
  }, [activeClientId, setCatalog, useApiStorage]);

  const reloadCatalogFromApi = useCallback(async () => {
    if (!useApiStorage || !activeClientId) return;
    const dto = await fetchWorkspace(activeClientId, activePlanningPeriodId);
    const ws = apiWorkspaceToClientWorkspace(dto);
    setCatalog(ws.catalog);
  }, [useApiStorage, activeClientId, activePlanningPeriodId, setCatalog]);

  const reloadWorkspaceContentFromApi = useCallback(async () => {
    if (!useApiStorage || !activeClientId || isReadOnly) return;
    const dto = await fetchWorkspace(activeClientId, activePlanningPeriodId);
    const ws = apiWorkspaceToClientWorkspace(dto);
    setPosts(ws.posts);
    setStartDate(ws.startDate);
    setCanvaPages(ws.canva.pages);
    setActiveCanvaPageId(ws.canva.activePageId);
    setAutoSyncCanva(ws.canva.autoSync);
    setCanvaGridReversed(ws.canva.reversed);
    setCanvaGridFormat(ws.canva.gridFormat ?? "square");
    setCanvaGridMaxWidth(ws.canva.gridMaxWidth ?? 480);
  }, [
    useApiStorage,
    activeClientId,
    activePlanningPeriodId,
    isReadOnly,
    setPosts,
    setStartDate,
    setCanvaPages,
    setActiveCanvaPageId,
    setAutoSyncCanva,
    setCanvaGridReversed,
    setCanvaGridFormat,
    setCanvaGridMaxWidth,
  ]);

  const reloadBrandGemFromApi = useCallback(async () => {
    if (!useApiStorage || !activeClientId || isReadOnly) return;
    const dto = await fetchWorkspace(activeClientId, activePlanningPeriodId);
    const ws = apiWorkspaceToClientWorkspace(dto);
    setBrandGem(ws.brandGem);
    setStartDate(ws.startDate);
  }, [
    useApiStorage,
    activeClientId,
    activePlanningPeriodId,
    isReadOnly,
    setBrandGem,
    setStartDate,
  ]);

  const {
    isEnriching: isEnrichingCatalog,
    progress: catalogEnrichProgress,
    startPolling: startCatalogEnrichPolling,
    stopLocalPolling: stopCatalogEnrichPolling,
  } = useCatalogEnrichmentWatcher({
    enabled: useApiStorage,
    clientId: activeClientId ?? "",
    workspaceHydrated,
    onCatalogReload: reloadCatalogFromApi,
  });

  const { publishSyncChange } = useRemoteSyncCoordinator({
    enabled: useApiStorage,
    clientId: activeClientId ?? "",
    periodId: activePlanningPeriodId ?? "",
    workspaceHydrated,
    handlers: {
      onCatalogChange: reloadCatalogFromApi,
      onWorkspaceChange: reloadWorkspaceContentFromApi,
      onBrandGemChange: reloadBrandGemFromApi,
      onPeriodsChange: applyRemotePlanningPeriods,
      onRegistryChange: applyRemoteRegistry,
    },
    onRemoteApplied: (domains) => {
      const labels = domains.map((d) => SYNC_DOMAIN_LABELS[d]).join(", ");
      toast.info(`Atualizado de outro dispositivo: ${labels}`);
    },
  });

  const catalogEnrichProgressLabel = catalogEnrichProgress
    ? `Indexando ${catalogEnrichProgress.index}/${catalogEnrichProgress.total} — ${catalogEnrichProgress.label} (um por vez)`
    : "Indexando… (um por vez, aguarde)";

  const captionBatchStats = useMemo(
    () => getCaptionBatchStats(posts, catalog),
    [posts, catalog]
  );

  const dashboardMetrics = useDashboardMetrics({
    posts,
    catalog,
    canvaPages,
    referenceCount: referenceCatalog.length,
    brandGemReady,
    brandGemMissingCount,
  });

  const router = useRouter();
  const goToDashboard = useCallback(() => {
    router.push(buildDashboardPath());
  }, [router]);

  const [activePreviewId, setActivePreviewId] = useState<string>(
    () => workspace.ui?.activePreviewId ?? "post_day1"
  );

  // UI state
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [profileViewItem, setProfileViewItem] = useState<CatalogItem | null>(null);
  const [newCatalogLabel, setNewCatalogLabel] = useState("");
  const [newCatalogImage, setNewCatalogImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [captionBatchProgress, setCaptionBatchProgress] = useState<CaptionBatchProgress | null>(
    null
  );
  useEffect(() => {
    if (!useApiStorage) return;
    const workspaceBusy = isProcessingAll || captionBatchProgress !== null;
    if (workspaceBusy) beginSyncDomain("workspace");
    else endSyncDomain("workspace");
    return () => endSyncDomain("workspace");
  }, [isProcessingAll, captionBatchProgress, useApiStorage]);
  const captionBatchAbortRef = useRef<AbortController | null>(null);
  const captionGenerateAbortRef = useRef<AbortController | null>(null);
  const batchCaptionHooksRef = useRef<string[]>([]);
  const captionGeneratePostIdRef = useRef<string | null>(null);
  /** Posts que apagaram legenda — próxima geração ignora cache e chama a IA de novo. */
  const captionCacheBypassRef = useRef(new Set<string>());
  const [catalogUploadProgress, setCatalogUploadProgress] =
    useState<CatalogUploadProgressState | null>(null);
  const catalogUploadAbortRef = useRef<AbortController | null>(null);
  const catalogUploadDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUploadingCatalog =
    catalogUploadProgress?.phase === "processing" ||
    catalogUploadProgress?.phase === "uploading";
  const { connectionStatus, health } = useAiSettings();
  
  const [selectedCanvaSlotId, setSelectedCanvaSlotId] = useState<string | null>(null);
  const [canvaLightbox, setCanvaLightbox] = useState<{
    image: string;
    label: string | null;
    slotNumber: number;
  } | null>(null);
  const [catalogLightbox, setCatalogLightbox] = useState<{
    image: string;
    label: string;
  } | null>(null);
  const [canvaSlotDragOver, setCanvaSlotDragOver] = useState<string | null>(null);

  const canvaImageCount = useMemo(
    () => canvaPages.flatMap((p) => p.slots).filter((s) => s?.image).length,
    [canvaPages]
  );

  const activeCanvaPage = useMemo(
    () => resolveActiveCanvaPage(canvaPages, activeCanvaPageId),
    [canvaPages, activeCanvaPageId]
  );

  /** Looks do acervo já colocados na página ativa do grid (catalogId → L1, L2…) */
  const catalogUsageOnActivePage = useMemo(() => {
    const map = new Map<string, number[]>();
    if (!activeCanvaPage) return map;
    activeCanvaPage.slots.forEach((slot, index) => {
      if (!slot.matchedCatalogId) return;
      const prev = map.get(slot.matchedCatalogId) ?? [];
      prev.push(index + 1);
      map.set(slot.matchedCatalogId, prev);
    });
    return map;
  }, [activeCanvaPage]);

  const selectedCanvaSlotNumber = useMemo(() => {
    if (!selectedCanvaSlotId || !activeCanvaPage) return null;
    const idx = activeCanvaPage.slots.findIndex((s) => s.id === selectedCanvaSlotId);
    return idx >= 0 ? idx + 1 : null;
  }, [selectedCanvaSlotId, activeCanvaPage]);

  const [activeSection, setActiveSection] = useState<AppSection>("posts");
  const [viewMode, setViewMode] = useState<"split" | "editorial">(
    () => workspace.ui?.viewMode ?? "split"
  );
  const [postsWorkTab, setPostsWorkTab] = useState<PostsWorkTab>(() =>
    workspace.ui?.viewMode === "editorial" ? "calendar" : "day"
  );
  const [swapSourceId, setSwapSourceId] = useState<string>("");
  const [timelineReorderMode, setTimelineReorderMode] = useState(false);
  const [settingsDraftDirty, setSettingsDraftDirty] = useState(false);
  const [distributionPrefs, setDistributionPrefsState] = useState<DistributionPrefs>(() => ({
    ...DEFAULT_DISTRIBUTION_PREFS,
    ...workspace.ui?.distributionPrefs,
  }));
  const [catalogTab, setCatalogTab] = useState<"references" | "grid">("references");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("brand");

  const routeHandlers = useMemo<AppRouteSyncHandlers>(
    () => ({
      setActiveSection,
      setPostsWorkTab,
      setViewMode,
      setCatalogTab,
      setSettingsTab,
      setActivePreviewId,
      setActiveCanvaPageId,
      setSelectedCanvaSlotId,
      switchPlanningPeriod,
      switchClient,
    }),
    [setActiveCanvaPageId, switchPlanningPeriod, switchClient]
  );

  const {
    handleNavigate,
    handlePostsWorkTabChange,
    handleCatalogTabChange,
    handleSettingsTabChange,
    selectPreviewPost,
    selectCanvaPage,
    selectCanvaSlot,
    navigateToClientSettings,
    navigateClient,
  } = useAppRouteSync({
    enabled: hasActiveClient,
    hasActiveClient,
    effectiveActiveClientId,
    registryClientIds: clients.map((c) => c.id),
    activeSection,
    settingsDraftDirty,
    postsWorkTab,
    catalogTab,
    settingsTab,
    activePreviewId,
    activeCanvaPageId,
    selectedCanvaSlotId,
    activePlanningPeriodId,
    posts,
    canvaPages,
    handlers: routeHandlers,
  });

  const cancelTimelineReorder = useCallback(() => {
    setTimelineReorderMode(false);
    setSwapSourceId("");
  }, []);

  const updateDistributionPrefs = useCallback(
    (partial: Partial<DistributionPrefs>) => {
      setDistributionPrefsState((prev) => {
        const next = { ...prev, ...partial };
        setUiPrefs({ distributionPrefs: next });
        return next;
      });
    },
    [setUiPrefs]
  );

  const confirmDistributionOverwrite = useCallback(async (): Promise<boolean> => {
    const editorialCount = postsRef.current.filter(
      (p) => p.caption?.trim() || p.isConfirmed || p.isGenerated
    ).length;
    if (editorialCount === 0) return true;
    return confirmDialog({
      title: "Redistribuir calendário?",
      message: `Existem ${editorialCount} post(s) com legenda ou aprovação. As fotos serão atualizadas conforme a nova distribuição; textos já salvos serão preservados quando possível.`,
      confirmLabel: "Distribuir",
    });
  }, []);

  const applySmartDistribution = useCallback(
    async (items: ScheduleItem[]) => {
      const validItems = items.filter((item) => item.image != null);
      if (validItems.length === 0) {
        toast.warning("Nenhuma imagem válida para distribuir.");
        return;
      }

      const preview = buildDistributionPreview(validItems.length, distributionPrefs);
      if (preview.overflowCount > 0) {
        toast.warning(
          "Capacidade insuficiente para todos os looks. Ajuste máx. posts/dia ou dias densos."
        );
        return;
      }

      if (!(await confirmDistributionOverwrite())) return;

      let prepared = validItems;
      if (useApiStorage && activeClientId) {
        prepared = await Promise.all(
          validItems.map(async (item) => {
            const persisted = await ensurePersistedImage(
              activeClientId,
              item.image!,
              "posts",
              item.imageAssetId
            );
            return {
              ...item,
              image: persisted.image,
              imageAssetId: persisted.imageAssetId,
            };
          })
        );
      }

      const finalizedList = scheduleItemsToPosts(
        prepared,
        postsRef.current,
        startDate,
        distributionPrefs
      );
      setPosts(finalizedList);
      const firstWithImg = finalizedList.find((p) => p.image) || finalizedList[0];
      if (firstWithImg) setActivePreviewId(firstWithImg.id);
      await saveWorkspaceNow();
      toast.success(
        `${validItems.length} look${validItems.length === 1 ? "" : "s"} distribuído${validItems.length === 1 ? "" : "s"} no calendário de 30 dias.`
      );
    },
    [
      distributionPrefs,
      useApiStorage,
      activeClientId,
      startDate,
      saveWorkspaceNow,
      confirmDistributionOverwrite,
    ]
  );

  const handleDistributeFromGrid = useCallback(() => {
    void applySmartDistribution(canvaSlotsToScheduleItems(canvaPages, canvaGridReversed));
  }, [applySmartDistribution, canvaPages, canvaGridReversed]);

  const [refineInstructions, setRefineInstructions] = useState<{ [postId: string]: string }>({});
  const [isRefining, setIsRefining] = useState<{ [postId: string]: boolean }>({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCanvaPdf, setIsExportingCanvaPdf] = useState(false);
  const [showNewPlanningPeriodModal, setShowNewPlanningPeriodModal] = useState(false);
  const [duplicateSourcePeriodId, setDuplicateSourcePeriodId] = useState<string | undefined>();

  const prevClientIdRef = useRef(activeClientId);

  // Ao trocar de cliente: mantém aba e modo de visualização; restaura só o dia/post desse cliente.
  useEffect(() => {
    if (!hasActiveClient || workspace.brandGem.id !== activeClientId) return;

    const clientChanged = prevClientIdRef.current !== activeClientId;
    prevClientIdRef.current = activeClientId;
    if (!clientChanged) return;

    setActivePreviewId(workspace.ui?.activePreviewId ?? "post_day1");
    setShowCatalogModal(false);
    setProfileViewItem(null);
    setRefineInstructions({});
    setSwapSourceId("");
    setTimelineReorderMode(false);
    setDistributionPrefsState({
      ...DEFAULT_DISTRIBUTION_PREFS,
      ...workspace.ui?.distributionPrefs,
    });
    setSelectedCanvaSlotId(null);
    setCanvaLightbox(null);
    setCatalogLightbox(null);
    setUiPrefs({ viewMode });
  }, [
    activeClientId,
    workspace.brandGem.id,
    workspace.ui?.activePreviewId,
    workspace.ui?.distributionPrefs,
    hasActiveClient,
    setUiPrefs,
    viewMode,
  ]);

  useEffect(() => {
    setUiPrefs({ activePreviewId });
  }, [activePreviewId, setUiPrefs]);

  // Drag and drop states
  const [catalogDragOver, setCatalogDragOver] = useState(false);
  const [postDragOver, setPostDragOver] = useState<{ [id: string]: boolean }>({});

  const catalogFileInputRef = useRef<HTMLInputElement>(null);
  const folderUploadInputRef = useRef<HTMLInputElement>(null);
  const filesUploadInputRef = useRef<HTMLInputElement>(null);
  const gridFolderUploadInputRef = useRef<HTMLInputElement>(null);
  const gridFilesUploadInputRef = useRef<HTMLInputElement>(null);
  const [gridCatalogDragOver, setGridCatalogDragOver] = useState(false);
  const catalogRef = useRef<CatalogItem[]>(catalog);
  const postsRef = useRef<PlannedPost[]>(posts);
  const apiWorkspaceReadyRef = useRef(!useApiStorage);
  const catalogEnrichAbortRef = useRef<AbortController | null>(null);
  
  // Elements references for scrolling focus
  const dayCardRefs = useRef<{ [postId: string]: HTMLDivElement | null }>({});

  // Synchronize Canva Grid state changes into Roteiros automatically
  const syncCanvaGridToTimeline = async (
    pagesList: CanvaGridPage[],
    showAlert: boolean = false
  ) => {
    const validCount = pagesList
      .flatMap((p) => p?.slots ?? [])
      .filter((s) => s?.image).length;

    if (validCount === 0) {
      if (showAlert) {
        toast.warning("Nenhum look com foto foi encontrado no Canva Grid para sincronizar!");
      }
      return;
    }

    setPosts((prevPosts) => {
      const finalizedList = syncCanvaPagesToPosts(
        pagesList,
        prevPosts,
        startDate,
        { reversed: canvaGridReversed, distribution: distributionPrefs }
      );

      const firstWithImg =
        finalizedList.find((p) => p && p.image !== null) || finalizedList[0];
      if (firstWithImg) {
        setTimeout(() => setActivePreviewId(firstWithImg.id), 50);
      }

      return finalizedList;
    });

    if (showAlert) {
      await saveWorkspaceNow();
      toast.success(
        `Sequência do Canva sincronizada com sucesso no Roteiro de 30 Dias!\n- ${validCount} looks organizados sequencialmente.\n- Legendas e aprovações existentes nos dias foram preservadas.`
      );
    }
  };

  useEffect(() => {
    initAiSettingsStore();
  }, []);

  useEffect(() => {
    return () => {
      catalogUploadAbortRef.current?.abort();
      if (catalogUploadDismissRef.current) clearTimeout(catalogUploadDismissRef.current);
    };
  }, []);

  const bindFolderUploadInput = useCallback((el: HTMLInputElement | null) => {
    folderUploadInputRef.current = el;
    enableFolderPickerInput(el);
  }, []);

  const bindGridFolderUploadInput = useCallback((el: HTMLInputElement | null) => {
    gridFolderUploadInputRef.current = el;
    enableFolderPickerInput(el);
  }, []);

  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    if (!useApiStorage) {
      apiWorkspaceReadyRef.current = true;
      return;
    }
    apiWorkspaceReadyRef.current = false;
    const onReady = () => {
      apiWorkspaceReadyRef.current = true;
    };
    window.addEventListener("auragrid:api-registry", onReady);
    return () => window.removeEventListener("auragrid:api-registry", onReady);
  }, [useApiStorage, activeClientId]);

  // Handle Automatic Synchronization of Canva Grid into Roteiros
  useEffect(() => {
    if (useApiStorage && !apiWorkspaceReadyRef.current) return;
    if (autoSyncCanva) {
      syncCanvaGridToTimeline(canvaPages, false);
    }
  }, [canvaPages, autoSyncCanva, canvaGridReversed, startDate, useApiStorage, distributionPrefs]);

  // Handle standard clipboard copy
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset demo showroom variables
  const handleResetPresets = async () => {
    if (!hasActiveClient) return;
    if (
      !(await confirmDialog({
        message: `Resetar o roteiro ativo de «${activeClient.name}»? Catálogo, posts e Canva deste roteiro voltam ao vazio. Roteiros arquivados são preservados.`,
        variant: "danger",
        confirmLabel: "Resetar",
      }))
    ) {
      return;
    }
    resetActiveClient();
    void navigateClient(
      { section: "posts", postsTab: "day", postId: "post_day1" },
      { replace: true, skipDirtyGuard: true }
    );
    toast.success(`Cliente «${activeClient.name}» foi resetado.`);
  };

  // Update starting planning date
  const handleStartDateChange = (newDate: string) => {
    setStartDate(newDate);
    setPosts((prev) => recalculatePostDates(newDate, prev));
    void saveWorkspaceNow();
  };

  // Add manually a single planning Day at the end of the timeline
  const handleAddDay = () => {
    setPosts(prev => {
      const maxDay = prev.length > 0 ? Math.max(...prev.map(p => p.dayNumber)) : 0;
      const nextDay = maxDay + 1;
      
      const newPost: PlannedPost = {
        id: `post_day${nextDay}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        dayNumber: nextDay,
        dateLabel: "", // will be computed in recalculatePostDates
        image: null,
        matchedCatalogId: null,
        reasoning: null,
        caption: "",
        isGenerating: false,
        isGenerated: false,
        isConfirmed: false,
        error: null
      };
      
      const updatedList = [...prev, newPost];
      return recalculatePostDates(startDate, updatedList);
    });
    
    // Select the newly added slot and scroll to it
    setTimeout(() => {
      setPosts(current => {
        if (current.length > 0) {
          const last = current[current.length - 1];
          setActivePreviewId(last.id);
          setTimeout(() => handleScrollToDay(last.id), 150);
        }
        return current;
      });
    }, 100);
  };

  // Add an additional post slot to a specific day (like multiple posts per day, up to 3 or more)
  const handleAddNewPostToDay = (dayNumber: number) => {
    setPosts(prev => {
      const newPost: PlannedPost = {
        id: `post_day${dayNumber}_extra_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        dayNumber: dayNumber,
        dateLabel: "", // will be calculated below
        image: null,
        matchedCatalogId: null,
        reasoning: null,
        caption: "",
        isGenerating: false,
        isGenerated: false,
        isConfirmed: false,
        error: null
      };
      
      // Let's insert the new post immediately after the last post of the target day!
      const lastIndex = prev.reduce((acc, curr, index) => curr.dayNumber === dayNumber ? index : acc, -1);
      
      let updatedList = [...prev];
      if (lastIndex !== -1) {
        updatedList.splice(lastIndex + 1, 0, newPost);
      } else {
        updatedList.push(newPost);
      }
      
      return recalculatePostDates(startDate, updatedList);
    });

    // Select this slot
    setTimeout(() => {
      setPosts(current => {
        const matches = current.filter(p => p.dayNumber === dayNumber);
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          setActivePreviewId(lastMatch.id);
          setTimeout(() => handleScrollToDay(lastMatch.id), 150);
        }
        return current;
      });
    }, 100);
  };

  // Remove a post slot completely from planning
  const handleRemovePost = async (postId: string) => {
    if (posts.length <= 1) {
      toast.warning("Você precisa manter pelo menos um post no seu planejamento.");
      return;
    }
    
    const postToDelete = posts.find(p => p.id === postId);
    if (!postToDelete) return;
    
    const confirmMessage = postToDelete.image 
      ? `Deseja mesmo remover o post do Dia ${postToDelete.dayNumber}? A imagem e legenda correspondente serão perdidas.`
      : `Deseja remover este slot de post do Dia ${postToDelete.dayNumber}?`;
      
    if (!(await confirmDialog({ message: confirmMessage, variant: "danger", confirmLabel: "Remover" }))) {
      return;
    }

    setPosts((prev) => {
      const filtered = prev.filter((p) => p.id !== postId);
      return recalculatePostDates(startDate, filtered);
    });

    await saveWorkspaceNow();
    
    setTimeout(() => {
      setPosts(current => {
        if (current.length > 0) {
          setActivePreviewId(current[0].id);
        }
        return current;
      });
    }, 100);
  };

  // Upload a batch of files and distribute across 30 days using current rules
  const handleBatchScheduleUpload = async (files: FileList) => {
    let imagesProcessed: { image: string, label: string }[] = [];
    
    // Sort files numerically by filename sequences (e.g. 1.jpg, 2.jpg... up to 34.jpg)
    const sortedFiles = Array.from(files).sort((a, b) => {
      const matchA = a.name.match(/\d+/);
      const matchB = b.name.match(/\d+/);
      const numA = matchA ? parseInt(matchA[0], 10) : NaN;
      const numB = matchB ? parseInt(matchB[0], 10) : NaN;
      
      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
    
    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      if (!file.type.startsWith("image/") && !file.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
        continue;
      }
      
      try {
        const base64Str = await fileToCatalogImageDataUrl(file);
        let label = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
        label = label.replace(/\b\w/g, c => c.toUpperCase());
        
        imagesProcessed.push({
          image: base64Str,
          label: label
        });
      } catch (err) {
        console.error("Erro processando arquivo para calendário:", file.name, err);
      }
    }

    if (imagesProcessed.length > 0) {
      const scheduleItems: ScheduleItem[] = imagesProcessed.map((img) => ({
        image: img.image,
        label: img.label,
        matchedCatalogId: null,
      }));

      await applySmartDistribution(scheduleItems);
    } else {
      toast.warning("Nenhuma imagem válida encontrada no lote selecionado.");
    }
  };

  // Smooth click scroll to day card
  const handleScrollToDay = (postId: string) => {
    selectPreviewPost(postId);
    const element = dayCardRefs.current[postId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-ag-accent", "scale-[1.01]");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-ag-accent", "scale-[1.01]");
      }, 1500);
      return;
    }
    const editorialRow = document.getElementById(`editorial-row-${postId}`);
    if (editorialRow) {
      editorialRow.scrollIntoView({ behavior: "smooth", block: "center" });
      editorialRow.classList.add("ring-2", "ring-ag-accent");
      setTimeout(() => {
        editorialRow.classList.remove("ring-2", "ring-ag-accent");
      }, 1500);
    }
  };

  // ==========================================
  // CANVA GRID MULTI-PAGE SYSTEM HANDLERS
  // ==========================================

  const saveCanvaGridNow = useCallback(async () => {
    await saveWorkspaceNow();
  }, [saveWorkspaceNow]);

  const applyCanvaSlotPatch = useCallback(
    async (
      pageId: string,
      slotId: string,
      patch: Pick<CanvaGridSlot, "image" | "imageAssetId" | "label" | "matchedCatalogId">
    ) => {
      setCanvaPages((prev) =>
        prev.map((page) => {
          if (page.id !== pageId) return page;
          return {
            ...page,
            slots: page.slots.map((slot) =>
              slot.id === slotId ? { ...slot, ...patch } : slot
            ),
          };
        })
      );
      await saveCanvaGridNow();
    },
    [saveCanvaGridNow, setCanvaPages]
  );

  const getCanvaBatchFillTargets = useCallback(
    (pages: CanvaGridPage[], activePageId: string) => {
      const activePageIndex = pages.findIndex((p) => p.id === activePageId);
      if (activePageIndex === -1) return [];
      const targets: { pageId: string; slotId: string }[] = [];
      for (let pIdx = activePageIndex; pIdx < pages.length; pIdx++) {
        const page = pages[pIdx];
        if (!page?.slots) continue;
        for (let sIdx = 11; sIdx >= 0; sIdx--) {
          const slot = page.slots[sIdx];
          if (slot) targets.push({ pageId: page.id, slotId: slot.id });
        }
      }
      return targets;
    },
    []
  );

  // Set item from wardrobe catalog into slot
  const handleAssignCatalogToCanvaSlot = async (
    pageId: string,
    slotId: string,
    item: CatalogItem | null
  ) => {
    const clientAtStart = activeClientId;
    try {
      let image = item?.image ?? null;
      let imageAssetId = item?.imageAssetId ?? extractMediaAssetId(image);
      if (useApiStorage && clientAtStart && item && image) {
        const persisted = await ensurePersistedImage(
          clientAtStart,
          image,
          "canva",
          imageAssetId
        );
        if (clientAtStart !== activeClientIdRef.current) return;
        image = persisted.image;
        imageAssetId = persisted.imageAssetId;
        if (!imageAssetId) {
          toast.error(
            "Não foi possível vincular a imagem deste look. Tente reenviar a foto pelo Catálogo."
          );
          return;
        }
      }

      await applyCanvaSlotPatch(pageId, slotId, {
        image: item ? image : null,
        imageAssetId: item ? imageAssetId : null,
        label: item ? item.label : `Look ${slotId.split("_").pop()}`,
        matchedCatalogId: item ? item.id : null,
      });
      setSelectedCanvaSlotId(null);
    } catch (err) {
      console.error("Erro ao atribuir look ao slot:", err);
      toast.error(
        "Não foi possível salvar o look neste slot. Verifique sua conexão e tente novamente."
      );
    }
  };

  // Click-to-swap slots or normal swap position within same page
  const handleSwapCanvaSlots = async (pageId: string, slotIdA: string, slotIdB: string) => {
    setCanvaPages((prev) => {
      return prev.map((page) => {
        if (page.id !== pageId) return page;

        const slots = [...page.slots];
        const idxA = slots.findIndex((s) => s.id === slotIdA);
        const idxB = slots.findIndex((s) => s.id === slotIdB);
        if (idxA === -1 || idxB === -1) return page;

        const temp = { ...slots[idxA] };
        slots[idxA] = {
          ...slots[idxA],
          image: slots[idxB].image,
          imageAssetId: slots[idxB].imageAssetId ?? null,
          label: slots[idxB].label,
          matchedCatalogId: slots[idxB].matchedCatalogId,
        };
        slots[idxB] = {
          ...slots[idxB],
          image: temp.image,
          imageAssetId: temp.imageAssetId ?? null,
          label: temp.label,
          matchedCatalogId: temp.matchedCatalogId,
        };

        return { ...page, slots };
      });
    });
    setSelectedCanvaSlotId(null);
    await saveCanvaGridNow();
  };

  // Upload file directly into Canva slot & replicate to reference catalog
  const handleUploadImageToCanvaSlot = async (pageId: string, slotId: string, file: File) => {
    const clientAtStart = activeClientId;
    try {
      const base64Str = await processImageFileForCanvaGrid(file);
      let label = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
      label = label.replace(/\b\w/g, (c) => c.toUpperCase());

      let image: string | null = base64Str;
      let imageAssetId: string | null = null;
      if (useApiStorage && clientAtStart) {
        const persisted = await ensurePersistedImage(clientAtStart, base64Str, "canva");
        if (clientAtStart !== activeClientIdRef.current) return;
        image = persisted.image;
        imageAssetId = persisted.imageAssetId;
        if (!imageAssetId) {
          toast.error("Não foi possível enviar a imagem para a nuvem.");
          return;
        }
      }

      await applyCanvaSlotPatch(pageId, slotId, {
        image,
        imageAssetId,
        label,
        matchedCatalogId: null,
      });
    } catch (err) {
      console.error("Erro no processamento da imagem do slot Canva:", err);
      toast.error("Não foi possível salvar a imagem neste slot.");
    }
  };

  const handleDropOnCanvaSlot = async (
    pageId: string,
    slotId: string,
    dt: DataTransfer
  ) => {
    const catalogId = dt.getData(CATALOG_DRAG_MIME);
    if (catalogId) {
      const item = canvaCatalog.find((c) => c.id === catalogId) ?? null;
      await handleAssignCatalogToCanvaSlot(pageId, slotId, item);
      return;
    }
    const file = await getImageFileFromDataTransfer(dt);
    if (file) {
      await handleUploadImageToCanvaSlot(pageId, slotId, file);
      return;
    }
    toast.warning(
      "Não foi possível colar esta imagem aqui. Exporte do Canva (PNG/JPG) ou arraste o arquivo da pasta Downloads."
    );
  };

  // Ctrl+V no slot selecionado (funciona se a imagem estiver no clipboard como PNG)
  useEffect(() => {
    if (activeSection !== "canva_grid" || !selectedCanvaSlotId) return;

    const onPaste = (e: ClipboardEvent) => {
      const file = getImageFileFromClipboard(e);
      if (!file) return;
      e.preventDefault();
      const activePage =
        canvaPages.find((p) => p.id === activeCanvaPageId) ||
        resolveActiveCanvaPage(canvaPages, activeCanvaPageId);
      if (!activePage) return;
      void handleUploadImageToCanvaSlot(activePage.id, selectedCanvaSlotId, file);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [activeSection, selectedCanvaSlotId, activeCanvaPageId, canvaPages]);

  // Duplicate an entire Canva Page
  const handleDuplicateCanvaPage = async (pageId: string) => {
    const targetPage = canvaPages.find(p => p.id === pageId);
    if (!targetPage) return;
    
    const newId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const duplicatedPage: CanvaGridPage = {
      id: newId,
      name: `${targetPage.name} (Cópia)`,
      slots: targetPage.slots.map((s, idx) => ({
        id: `slot_${newId}_${idx}`,
        image: s.image,
        imageAssetId: s.imageAssetId ?? extractMediaAssetId(s.image),
        label: s.label,
        matchedCatalogId: s.matchedCatalogId,
      }))
    };

    setCanvaPages((prev) => {
      const idx = prev.findIndex((p) => p.id === pageId);
      if (idx === -1) return renumberCanvaPages([...prev, duplicatedPage]);
      const copy = [...prev];
      copy.splice(idx + 1, 0, duplicatedPage);
      return renumberCanvaPages(copy);
    });
    setActiveCanvaPageId(newId);
    await saveCanvaGridNow();
  };

  // Add a blank Canva Page (nova = Página 1; as antigas sobem de número)
  const handleAddCanvaPage = async () => {
    const newId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setCanvaPages((prev) => prependCanvaPage(prev, newId));
    setActiveCanvaPageId(newId);
    await saveCanvaGridNow();
  };

  const handleReorderCanvaPages = async (fromIndex: number, toIndex: number) => {
    setCanvaPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return prev;
      next.splice(toIndex, 0, moved);
      return renumberCanvaPages(next);
    });
    await saveCanvaGridNow();
  };

  // Delete a Canva Page
  const handleDeleteCanvaPage = async (pageId: string) => {
    if (canvaPages.length <= 1) {
      toast.warning("Sua área de trabalho precisa ter pelo menos uma página de planejamento.");
      return;
    }
    if (
      !(await confirmDialog({
        message: "Tem certeza que deseja apagar esta página do Canva Grid?",
        variant: "danger",
        confirmLabel: "Apagar",
      }))
    ) {
      return;
    }
    const deletedIdx = canvaPages.findIndex((p) => p.id === pageId);
    const remainingPages = renumberCanvaPages(canvaPages.filter((p) => p.id !== pageId));
    setCanvaPages(remainingPages);
    if (activeCanvaPageId === pageId && remainingPages.length > 0) {
      const nextIdx = Math.min(Math.max(deletedIdx, 0), remainingPages.length - 1);
      setActiveCanvaPageId(remainingPages[nextIdx]!.id);
    }
    await saveCanvaGridNow();
  };

  // Clear slots of a Canva page
  const handleClearCanvaPage = async (pageId: string) => {
    if (
      !(await confirmDialog({
        message: "Deseja mesmo zerar todas as fotos desta página?",
        variant: "danger",
        confirmLabel: "Zerar",
      }))
    ) {
      return;
    }
    setCanvaPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p;
        return createEmptyCanvaPage(p.name, p.id);
      })
    );
    await saveCanvaGridNow();
  };

  // Batch upload specific to Canva Grid (re-sequences numerically & rolls over page capacity)
  const handleBatchUploadToCanva = async (files: FileList) => {
    const sortedFiles = Array.from(files).sort((a, b) => {
      const matchA = a.name.match(/\d+/);
      const matchB = b.name.match(/\d+/);
      const numA = matchA ? parseInt(matchA[0], 10) : NaN;
      const numB = matchB ? parseInt(matchB[0], 10) : NaN;
      
      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

    const fillTargets = getCanvaBatchFillTargets(canvaPages, activeCanvaPageId);
    if (fillTargets.length === 0) {
      toast.warning("Nenhuma página ativa no grid para receber as imagens.");
      return;
    }

    let savedCount = 0;
    let uploadFailures = 0;
    let targetIndex = 0;

    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i];
      if (!file.type.startsWith("image/") && !file.name.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
        continue;
      }
      if (targetIndex >= fillTargets.length) break;

      try {
        const base64Str = await processImageFileForCanvaGrid(file);
        let label = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
        label = label.replace(/\b\w/g, (c) => c.toUpperCase());

        let image: string = base64Str;
        let imageAssetId: string | null = null;
        if (useApiStorage && activeClientId) {
          const persisted = await ensurePersistedImage(activeClientId, base64Str, "canva");
          image = persisted.image ?? base64Str;
          imageAssetId = persisted.imageAssetId;
          if (!imageAssetId) {
            uploadFailures++;
            toast.error(`Não foi possível enviar "${file.name}" para a nuvem.`);
            continue;
          }
        }

        const target = fillTargets[targetIndex]!;
        targetIndex++;
        await applyCanvaSlotPatch(target.pageId, target.slotId, {
          image,
          imageAssetId,
          label,
          matchedCatalogId: null,
        });
        savedCount++;
      } catch (err) {
        console.error(err);
        uploadFailures++;
      }
    }

    if (savedCount === 0) {
      toast.warning(
        uploadFailures > 0
          ? "Nenhuma imagem foi enviada para a nuvem. Verifique a conexão e tente novamente."
          : "Nenhuma imagem válida para carregar."
      );
      return;
    }

    toast.success(
      `${savedCount} foto(s) salvas no grid${savedCount > fillTargets.length ? "" : " (página ativa e seguintes)"}.`
    );
    if (uploadFailures > 0) {
      toast.warning(
        `${uploadFailures} arquivo(s) não foram enviados para a nuvem e foram ignorados.`
      );
    }
    if (sortedFiles.length > savedCount + uploadFailures) {
      toast.info(
        `Só há ${fillTargets.length} slot(s) disponíveis a partir da página ativa; imagens excedentes foram ignoradas.`
      );
    }
  };

  // Plan 30 Days based on Canva layouts sequence
  const handlePlanFromCanva = (scope: "active" | "all", reverseOrder: boolean = true) => {
    const pages =
      scope === "active"
        ? canvaPages.filter((p) => p.id === activeCanvaPageId)
        : canvaPages;

    const items = canvaSlotsToScheduleItems(pages, reverseOrder);
    if (items.length === 0) {
      toast.warning(
        "Nenhuma foto no Grid Canva para aplicar. Adicione looks nas páginas primeiro."
      );
      return;
    }

    void applySmartDistribution(items);
  };

  // Toggle single post confirmation
  const handleToggleConfirm = (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const nextConfirm = !p.isConfirmed;
        return { ...p, isConfirmed: nextConfirm };
      }
      return p;
    }));
  };

  // Move / Swap sequence order of days to fix Feed organization aesthetics
  const handleSwapDays = (sourceId: string, destId: string) => {
    if (!sourceId || !destId || sourceId === destId) return;
    
    const sourceIdx = posts.findIndex(p => p.id === sourceId);
    const destIdx = posts.findIndex(p => p.id === destId);
    
    if (sourceIdx === -1 || destIdx === -1) return;

    // We swap their look image, captions, matching, and confirmed state, but preserve their respective structured Monday-Sunday names!
    const updated = [...posts];
    const sourcePost = { ...updated[sourceIdx] };
    const destPost = { ...updated[destIdx] };

    // Swap values
    updated[sourceIdx] = {
      ...sourcePost,
      image: destPost.image,
      imageAssetId: destPost.imageAssetId ?? null,
      canvaSlotRef: destPost.canvaSlotRef ?? null,
      matchedCatalogId: destPost.matchedCatalogId,
      reasoning: destPost.reasoning,
      caption: destPost.caption,
      isGenerated: destPost.isGenerated,
      isConfirmed: destPost.isConfirmed,
      error: destPost.error
    };

    updated[destIdx] = {
      ...destPost,
      image: sourcePost.image,
      imageAssetId: sourcePost.imageAssetId ?? null,
      canvaSlotRef: sourcePost.canvaSlotRef ?? null,
      matchedCatalogId: sourcePost.matchedCatalogId,
      reasoning: sourcePost.reasoning,
      caption: sourcePost.caption,
      isGenerated: sourcePost.isGenerated,
      isConfirmed: sourcePost.isConfirmed,
      error: sourcePost.error
    };

    setPosts(updated);
    void saveWorkspaceNow();
    setSwapSourceId("");
    setTimelineReorderMode(false);
    toast.success(`Sequência modificada! Os conteúdos de "${sourcePost.dateLabel}" e "${destPost.dateLabel}" foram invertidos para harmonização visual.`);
  };

  // Process uploaded image file into lightweight base64
  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const result = reader.result as string;
        try {
          const resized = await resizeImage(result, 500, 500);
          resolve(resized);
        } catch (err) {
          resolve(result); // Fallback to raw representation on error
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  /** Maior resolução para o grid Canva — lupa e export ficam mais nítidos. */
  const processImageFileForCanvaGrid = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const result = reader.result as string;
        try {
          const resized = await resizeImage(result, 1400, 1400);
          resolve(resized);
        } catch {
          resolve(result);
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const patchCatalogItem = (
    id: string,
    patch: Partial<CatalogItem>
  ) => {
    setCatalog((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      catalogRef.current = next;
      return next;
    });
  };

  const resetCatalogProcessingState = () => {
    setCatalog((prev) => {
      const next = prev.map((c) =>
        c.enrichmentStatus === "processing"
          ? { ...c, enrichmentStatus: "pending" as const, enrichmentError: undefined }
          : c
      );
      catalogRef.current = next;
      return next;
    });
  };

  const reloadWorkspaceFromApi = async () => {
    if (!useApiStorage || !activeClientId) return;
    const dto = await fetchWorkspace(activeClientId, activePlanningPeriodId);
    const ws = apiWorkspaceToClientWorkspace(dto);
    setCatalog(ws.catalog);
    setPosts(ws.posts);
    setStartDate(ws.startDate);
    setCanvaPages(ws.canva.pages);
    setActiveCanvaPageId(ws.canva.activePageId);
    setAutoSyncCanva(ws.canva.autoSync);
    setCanvaGridReversed(ws.canva.reversed);
    setCanvaGridFormat(ws.canva.gridFormat ?? "square");
    setCanvaGridMaxWidth(ws.canva.gridMaxWidth ?? 480);
    setUiPrefs(ws.ui ?? {});
  };

  const stopCatalogEnrichment = () => {
    if (useApiStorage && activeClientId) {
      void stopEnrichCatalogApi(activeClientId)
        .then(() => reloadWorkspaceFromApi())
        .then(() => publishSyncChange(["catalog"]));
      stopCatalogEnrichPolling();
      return;
    }
    catalogEnrichAbortRef.current?.abort();
    catalogEnrichAbortRef.current = null;
    resetCatalogProcessingState();
  };

  const runCatalogEnrichment = async (items: CatalogItem[]) => {
    const prepared = items.map(prepareCatalogItemForEnrichment);

    if (!useApiStorage || !activeClientId) {
      if (storageMode !== "local") {
        toast.warning("Entre na sua conta para indexar o catálogo. Os dados ficam salvos na nuvem.");
      }
      return;
    }

    const ids = prepared.map((c) => c.id);
    const idSet = new Set(ids);
    setCatalog((prev) => {
      const next = prev.map((c) => (idSet.has(c.id) ? prepareCatalogItemForEnrichment(c) : c));
      catalogRef.current = next;
      return next;
    });
    beginSyncDomain("catalog");
    try {
      await enrichCatalogApi(activeClientId, ids.length ? ids : undefined);
      void publishSyncChange(["catalog"]);
    } finally {
      endSyncDomain("catalog");
    }
    startCatalogEnrichPolling();
  };

  // Importa imagens para o guarda-roupa de referências (aba Catálogo)
  const scheduleCatalogUploadDismiss = useCallback(() => {
    if (catalogUploadDismissRef.current) clearTimeout(catalogUploadDismissRef.current);
    catalogUploadDismissRef.current = setTimeout(() => {
      setCatalogUploadProgress(null);
      catalogUploadDismissRef.current = null;
    }, 5000);
  }, []);

  const cancelCatalogUpload = useCallback(() => {
    catalogUploadAbortRef.current?.abort();
    catalogUploadAbortRef.current = null;
    if (catalogUploadDismissRef.current) {
      clearTimeout(catalogUploadDismissRef.current);
      catalogUploadDismissRef.current = null;
    }
    setCatalogUploadProgress(null);
    toast.info("Envio cancelado.");
  }, []);

  const handleBatchImages = async (
    fileList: FileList | File[],
    options?: { asReference?: boolean }
  ) => {
    const asReference = options?.asReference ?? true;
    const allFiles = Array.from(fileList);
    const candidates = prepareCatalogUploadCandidates(allFiles, { asReference });

    if (useApiStorage && !activeClientId) {
      toast.warning("Crie ou selecione um cliente na barra lateral antes de enviar imagens.");
      return;
    }

    if (isUploadingCatalog) return;

    if (candidates.length === 0) {
      const total = allFiles.length;
      toast.warning(
        total > 0
          ? `Nenhuma imagem válida encontrada entre ${total} arquivo(s).\n\nUse JPG, PNG ou WebP dentro das subpastas (ex.: Fotos(6)/#00874/foto.jpg).`
          : "Nenhum arquivo encontrado na pasta selecionada."
      );
      return;
    }

    catalogUploadAbortRef.current?.abort();
    const controller = new AbortController();
    catalogUploadAbortRef.current = controller;

    const total = candidates.length;
    const startedAt = Date.now();
    setCatalogUploadProgress(createInitialUploadProgress(total));

    try {
      if (useApiStorage && activeClientId) {
        beginSyncDomain("catalog");
        let uploadSucceeded = false;
        try {
        const { items, errors, cancelled } = await uploadCatalogCandidatesSequential(
          activeClientId,
          candidates,
          {
            isReference: asReference,
            signal: controller.signal,
            onProgress: setCatalogUploadProgress,
          }
        );

        if (items.length > 0) {
          setCatalog((prev) => [
            ...items.map((c) => ({ ...c, image: resolveCatalogItemImage(c) })),
            ...prev,
          ]);
        }

        if (cancelled || controller.signal.aborted) {
          if (items.length > 0) {
            uploadSucceeded = true;
            toast.info(
              `Envio interrompido. ${items.length} arquivo(s) já foram salvos no catálogo.`
            );
          }
          setCatalogUploadProgress(null);
          if (uploadSucceeded) {
            void publishSyncChange(["catalog"]);
          }
          return;
        }

        const skipped = allFiles.length - candidates.length;
        const succeeded = items.length;
        const failed = errors.length;

        setCatalogUploadProgress({
          phase: "done",
          current: total,
          total,
          fileName: "",
          label: "",
          filePercent: 100,
          overallPercent: 100,
          bytesLoaded: 0,
          bytesTotal: 0,
          startedAt,
          succeeded,
          failed,
          etaSeconds: 0,
          statusMessage:
            asReference
              ? `${succeeded} referência${succeeded !== 1 ? "s" : ""} enviada${succeeded !== 1 ? "s" : ""}` +
                (skipped > 0 ? ` · ${skipped} ignorado${skipped !== 1 ? "s" : ""}` : "")
              : `${succeeded} peça${succeeded !== 1 ? "s" : ""} de grid enviada${succeeded !== 1 ? "s" : ""}`,
        });

        if (succeeded > 0) {
          uploadSucceeded = true;
          toast.success(
            asReference
              ? `${succeeded} referência(s) adicionada(s).`
              : `${succeeded} peça(s) de grid adicionada(s).`
          );
        }
        if (failed > 0) {
          toast.error(
            `${failed} arquivo(s) falharam no envio.${errors[0] ? `\n${errors[0].fileName}: ${errors[0].message}` : ""}`
          );
        }
        if (uploadSucceeded) {
          void publishSyncChange(["catalog"]);
        }
        } finally {
          endSyncDomain("catalog");
        }
        scheduleCatalogUploadDismiss();
        return;
      }

      if (storageMode !== "local") {
        setCatalogUploadProgress(null);
        toast.warning("Entre na sua conta para enviar imagens. Os dados ficam salvos na nuvem.");
        return;
      }

      const newItems: CatalogItem[] = [];
      let failedCount = 0;

      for (let i = 0; i < candidates.length; i++) {
        if (controller.signal.aborted) return;

        const { file, label } = candidates[i]!;
        const index = i + 1;
        const fileSize = file.size || 0;

        setCatalogUploadProgress({
          phase: "processing",
          current: index,
          total,
          fileName: file.name,
          label,
          filePercent: 10,
          overallPercent: computeOverallUploadPercent(total, index, 10),
          bytesLoaded: 0,
          bytesTotal: fileSize,
          startedAt,
          succeeded: newItems.length,
          failed: failedCount,
          etaSeconds: estimateUploadEtaSeconds(startedAt, total, index, 10),
          statusMessage: `Processando ${index} de ${total}…`,
        });

        try {
          const base64Str = await fileToCatalogImageDataUrl(file);
          if (controller.signal.aborted) return;

          newItems.push({
            id: "cat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
            label,
            image: base64Str,
            description: asReference
              ? `Importado em ${new Date().toLocaleDateString("pt-BR")} do arquivo original '${file.name}'`
              : `Peça de grid importada em ${new Date().toLocaleDateString("pt-BR")} do arquivo '${file.name}' — não usada como referência de look`,
            isReference: asReference,
            enrichmentStatus: asReference ? "pending" : undefined,
          });

          setCatalogUploadProgress({
            phase: "processing",
            current: index,
            total,
            fileName: file.name,
            label,
            filePercent: 100,
            overallPercent: computeOverallUploadPercent(total, index, 100),
            bytesLoaded: fileSize,
            bytesTotal: fileSize,
            startedAt,
            succeeded: newItems.length,
            failed: failedCount,
            etaSeconds: estimateUploadEtaSeconds(startedAt, total, index, 100),
            statusMessage:
              index < total ? `Salvo ${index} de ${total}` : "Finalizando…",
          });
        } catch (err) {
          failedCount++;
          console.error("Erro ao converter arquivo de lote:", file.name, err);
        }
      }

      if (newItems.length > 0) {
        setCatalog((prev) => {
          const next = [...newItems, ...prev];
          catalogRef.current = next;
          return next;
        });
        toast.success(
          asReference
            ? `Sucesso! ${newItems.length} referência(s) adicionada(s).`
            : `Sucesso! ${newItems.length} peça(s) de grid adicionada(s).`
        );
      } else if (failedCount > 0) {
        toast.error("Não foi possível processar imagens do lote selecionado.");
      }

      setCatalogUploadProgress({
        phase: failedCount > 0 && newItems.length === 0 ? "error" : "done",
        current: total,
        total,
        fileName: "",
        label: "",
        filePercent: 100,
        overallPercent: 100,
        bytesLoaded: 0,
        bytesTotal: 0,
        startedAt,
        succeeded: newItems.length,
        failed: failedCount,
        etaSeconds: 0,
        statusMessage:
          newItems.length > 0
            ? `${newItems.length} imagem(ns) salva(s) no navegador`
            : "Nenhuma imagem foi processada",
      });
      scheduleCatalogUploadDismiss();
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) {
        setCatalogUploadProgress(null);
        return;
      }
      const message = err instanceof Error ? err.message : "Falha ao enviar imagens.";
      console.error("[AuraGrid] upload catálogo:", err);
      setCatalogUploadProgress({
        phase: "error",
        current: 0,
        total,
        fileName: "",
        label: "",
        filePercent: 0,
        overallPercent: 0,
        bytesLoaded: 0,
        bytesTotal: 0,
        startedAt,
        succeeded: 0,
        failed: total,
        etaSeconds: null,
        statusMessage: message,
      });
      toast.error(
        `Não foi possível enviar as imagens.\n\n${message}\n\n` +
          "Confira: login ativo, SQUARECLOUD_BLOB_API_KEY (ou MINIO_*), e os logs da aplicação."
      );
    } finally {
      if (catalogUploadAbortRef.current === controller) {
        catalogUploadAbortRef.current = null;
      }
    }
  };

  const confirmBrowserFolderImport = async (context: "reference" | "grid") => {
    const noun =
      context === "reference" ? "referências do catálogo" : "peças de grid";
    return confirmDialog({
      title: "Importar pasta",
      message:
        `O navegador (Chrome/Brave) vai pedir permissão para ler os arquivos da pasta — ` +
        `na janela «Fazer upload de X arquivos», clique em Fazer upload. ` +
        `Isso é proteção do navegador; o AuraGrid não controla essa tela.\n\n` +
        `Dica: arrastar a pasta para a área tracejada costuma ser mais rápido e evita um passo.\n\n` +
        `Continuar para selecionar a pasta de ${noun}?`,
      confirmLabel: "Selecionar pasta",
    });
  };

  const openReferenceFolderPicker = async () => {
    if (!(await confirmBrowserFolderImport("reference"))) return;
    const files = await pickFilesFromFolder(folderUploadInputRef.current);
    if (files === null) return;
    if (files.length === 0) {
      toast.warning("A pasta está vazia ou não contém arquivos acessíveis.");
      return;
    }
    await handleBatchImages(files, { asReference: true });
  };

  const openGridFolderPicker = async () => {
    if (!(await confirmBrowserFolderImport("grid"))) return;
    const files = await pickFilesFromFolder(gridFolderUploadInputRef.current);
    if (files === null) return;
    if (files.length === 0) {
      toast.warning("A pasta está vazia ou não contém arquivos acessíveis.");
      return;
    }
    await handleBatchImages(files, { asReference: false });
  };

  const handleFilesUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleBatchImages(e.target.files, { asReference: true });
    }
    e.target.value = "";
  };

  const handleGridFilesUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleBatchImages(e.target.files, { asReference: false });
    }
    e.target.value = "";
  };

  const clearGridCatalog = useCallback(async () => {
    if (gridCatalog.length === 0) {
      toast.info("Não há peças de grid no acervo.");
      return;
    }
    if (
      !(await confirmDialog({
        message: `Remover todas as ${gridCatalog.length} peça(s) de grid?\n\nAs referências de looks permanecem intactas.`,
        variant: "danger",
        confirmLabel: "Remover",
      }))
    ) {
      return;
    }
    if (useApiStorage && activeClientId) {
      beginSyncDomain("catalog");
      try {
        await clearGridCatalogApi(activeClientId);
        await reloadWorkspaceFromApi();
        void publishSyncChange(["catalog"]);
      } catch (err) {
        console.error("Erro ao limpar peças de grid:", err);
        toast.error("Não foi possível remover as peças de grid na nuvem.");
      } finally {
        endSyncDomain("catalog");
      }
      return;
    }

    const gridIds = new Set(gridCatalog.map((c) => c.id));
    setCatalog((prev) => prev.filter((c) => !gridIds.has(c.id)));
  }, [gridCatalog, setCatalog, useApiStorage, activeClientId, publishSyncChange]);

  // Upload Look image for a planned sequence day
  const handlePostPhotoUpload = async (postId: string, file: File) => {
    const clientAtStart = activeClientIdRef.current;
    try {
      const base64 = await processImageFile(file);
      let image: string | null = base64;
      let imageAssetId: string | null = null;
      if (useApiStorage && clientAtStart) {
        const persisted = await ensurePersistedImage(clientAtStart, base64, "posts");
        if (clientAtStart !== activeClientIdRef.current) return;
        image = persisted.image;
        imageAssetId = persisted.imageAssetId;
        if (!imageAssetId) {
          toast.error("Não foi possível enviar a foto para a nuvem.");
          return;
        }
      }
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                image,
                imageAssetId,
                isGenerated: false,
                isConfirmed: false,
                matchedCatalogId: null,
                reasoning: null,
                caption: "",
              }
            : p
        )
      );
      await saveWorkspaceNow();
    } catch (err) {
      console.error("Erro ao enviar foto do post:", err);
      toast.error("Não foi possível salvar a foto neste dia.");
    }
  };

  const isQuotaErrorMessage = (message: string) =>
    /429|cota|quota|RESOURCE_EXHAUSTED|rate.?limit|Groq|Gemini/i.test(message);

  const ensureCatalogIndexedForMatch = async (): Promise<boolean> => {
    const refs = getReferenceCatalog(catalogRef.current);
    if (refs.length === 0) return true;
    if (catalogReadyForTextMatch(refs)) return true;

    const notReady = refs.filter((c) => c.enrichmentStatus !== "ready" || !c.visualProfile);
    const indexNow = await confirmDialog({
      message:
        `${notReady.length} referência(s) do catálogo ainda não estão indexadas (JSON).\n\n` +
        `A geração de legendas compara a foto do post com os perfis JSON das referências — todas precisam estar indexadas.\n\n` +
        `Indexar agora? (1 chamada por foto, com pausa automática.)`,
      confirmLabel: "Indexar",
    });
    if (!indexNow) return false;

    await runCatalogEnrichment(notReady);
    const after = getReferenceCatalog(catalogRef.current);
    if (!catalogReadyForTextMatch(after)) {
      toast.warning(
        "Ainda há referências sem índice JSON. Conclua a indexação no painel de referências antes de gerar legendas."
      );
      return false;
    }
    return true;
  };

  const stopCaptionGeneration = useCallback((postId?: string) => {
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
          return { ...p, isGenerating: false, error: undefined };
        }
        return p;
      })
    );
  }, []);

  // Match visual + legenda (tom e rodapé vêm do Gem configurado)
  const ensureBrandGemConfigured = useCallback((): boolean => {
    if (isBrandGemReadyForCaptions(brandGem)) return true;
    toast.warning(brandGemRequiredMessage(brandGem));
    void handleNavigate("settings");
    return false;
  }, [brandGem, handleNavigate]);

  const matchAndGenerateForPost = async (
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

    const recordBatchCaptionHook = (caption: string) => {
      const hook = extractMainCaptionText(caption, brandGem.footer).trim();
      if (!hook) return;
      if (
        batchCaptionHooksRef.current.some(
          (h) => h.toLowerCase() === hook.toLowerCase()
        )
      ) {
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
              ...(options?.force
                ? { isGenerated: false, isConfirmed: false }
                : {}),
            }
          : p
      )
    );

    try {
      const processedPostImage = await preparePostImageForAi(post.image);
      const imageOnly = !!post.captionFromImageOnly;

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
      if (
        !imageOnly &&
        refs.length > 0 &&
        !catalogReadyForTextMatch(refs)
      ) {
        toast.warning(
          "Todas as referências do catálogo precisam estar indexadas (JSON) antes de gerar a legenda."
        );
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, isGenerating: false } : p))
        );
        return {};
      }

      const bypassCaptionCache =
        options?.force ||
        options?.skipCache ||
        captionCacheBypassRef.current.has(postId);

      const extraAvoidHooks: string[] = [];
      if (options?.force && post.caption?.trim()) {
        const avoidHook = extractMainCaptionText(post.caption, brandGem.footer).trim();
        if (avoidHook) extraAvoidHooks.push(avoidHook);
      }

      let recentHooks = buildRecentHooks(extraAvoidHooks);

      const buildRequestBody = (regenerate = false, hooks = recentHooks) => {
        const body: Record<string, unknown> = {
          postImage: processedPostImage,
          brandGem,
          ...(useApiStorage && activeClientId ? { clientId: activeClientId } : {}),
          ...(regenerate || options?.force || bypassCaptionCache
            ? { regenerateCaption: true }
            : {}),
          ...(imageOnly ? { captionFromImageOnly: true } : {}),
        };
        if (hooks.length > 0) {
          body.recentHooks = hooks;
          if (hooks.length >= 3) {
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
      });

      const applyCaptionResult = async (
        caption: string,
        matchedId: string | null,
        reasoning: string | null,
        providerUsed?: string,
        matchMode?: string
      ) => {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  matchedCatalogId: matchedId,
                  reasoning,
                  caption,
                  isGenerating: false,
                  isGenerated: true,
                  error: null,
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
              matchedLabel: resolveCatalogLabel(refs, effectiveMatchedId),
              footer: brandGem.footer,
              captionParams: brandGem.captionParams,
            });
            setPosts((prev) =>
              prev.map((p) =>
                p.id === postId
                  ? {
                      ...p,
                      matchedCatalogId: effectiveMatchedId,
                      reasoning: cached.reasoning,
                      caption: cachedCaption,
                      isGenerating: false,
                      isGenerated: true,
                      error: null,
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
      }> => {
        const response = await aiQueue.enqueue(
          captionQueueLabel(postId, post.dayNumber),
          () =>
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
        }>(response);

        if (!response.ok) {
          throw new Error(result.error || "Falha ao gerar legenda no servidor.");
        }

        const providerUsed = response.headers.get("X-AI-Provider-Used") ?? undefined;
        noteLastProviderUsed(providerUsed);
        const matchMode = response.headers.get("X-AI-Match-Mode") ?? undefined;
        const matchedId = imageOnly ? null : (result.matchedId ?? null);
        const caption = finalizeCaption(result.caption ?? "", {
          matchedCatalogId: matchedId,
          matchedLabel: resolveCatalogLabel(refs, matchedId),
          footer: brandGem.footer,
          captionParams: brandGem.captionParams,
        });

        return {
          matchedId,
          reasoning: result.reasoning ?? null,
          caption,
          providerUsed,
          matchMode,
        };
      };

      let body = buildRequestBody();
      let result = await callMatchAndGenerate(body);

      const mainHook = extractMainCaptionText(result.caption, brandGem.footer).trim();
      if (mainHook && isHookTooSimilar(mainHook, recentHooks)) {
        const retryHooks = mergeRecentCaptionSignals(
          getPostsSnapshot(),
          [mainHook, ...extraAvoidHooks, ...batchCaptionHooksRef.current],
          postId,
          brandGem.footer,
          15
        );
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
          cachedAt: Date.now(),
        });
      } else {
        setCachedCaption(cacheKey, {
          caption: result.caption,
          matchedId: result.matchedId,
          reasoning: result.reasoning,
          providerUsed: result.providerUsed,
          matchMode: result.matchMode,
          cachedAt: Date.now(),
        });
      }

      await applyCaptionResult(
        result.caption,
        result.matchedId,
        result.reasoning,
        result.providerUsed,
        result.matchMode
      );
      return { quotaExceeded: false };
    } catch (error: unknown) {
      if (isAbortError(error) || controller.signal.aborted) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, isGenerating: false } : p))
        );
        return {};
      }
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Falha na conexão com a API de IA.";
      const quotaExceeded = isQuotaErrorMessage(message);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, isGenerating: false, error: message } : p
        )
      );
      return { quotaExceeded };
    } finally {
      if (captionGeneratePostIdRef.current === postId) {
        captionGenerateAbortRef.current = null;
        captionGeneratePostIdRef.current = null;
      }
    }
  };

  const stopCaptionBatch = () => {
    captionBatchAbortRef.current?.abort();
    captionBatchAbortRef.current = null;
    stopCaptionGeneration();
    setIsProcessingAll(false);
    setCaptionBatchProgress(null);
  };

  const runCaptionBatch = async (targets: PlannedPost[]) => {
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

        if (controller.signal.aborted) break;
      }
    } finally {
      if (captionBatchAbortRef.current === controller) {
        captionBatchAbortRef.current = null;
      }
      setIsProcessingAll(false);
      setCaptionBatchProgress(null);
      await saveWorkspaceNow();
    }
  };

  const handleRunAllMatching = async () => {
    if (!ensureBrandGemConfigured()) return;

    const pending = getPendingCaptionPosts(posts);
    if (pending.length === 0) {
      toast.info("Não há posts com foto aguardando legenda. Carregue as imagens ou use “Tentar novamente” nos erros.");
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
  };

  const handleRegenerateCaptionErrors = () => {
    if (!ensureBrandGemConfigured()) return;

    const failed = posts.filter((p) => p.image && p.error && !p.isGenerating);
    if (failed.length === 0) return;
    void runCaptionBatch(failed);
  };

  const handleToggleCaptionFromImageOnly = (postId: string, enabled: boolean) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              captionFromImageOnly: enabled,
              ...(enabled ? { matchedCatalogId: null } : {}),
              isConfirmed: false,
            }
          : p
      )
    );
  };

  // Direct manual modification of part of the caption live
  const updateCaptionBodyManual = (postId: string, text: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      caption: text,
      isConfirmed: false
    } : p));
  };

  const handleClearCaption = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    if (!post.caption && !post.isGenerated && !post.reasoning && !post.error) return;

    stopCaptionGeneration(postId);
    captionCacheBypassRef.current.add(postId);

    if (post.image) {
      try {
        const processed = await preparePostImageForAi(post.image);
        const refs = getReferenceCatalog(catalogRef.current);
        const cacheKey = buildCaptionCacheKey({
          imageDataUrl: processed,
          postId,
          brandGem,
          catalogIds: refs.map((c) => c.id),
          captionFromImageOnly: !!post.captionFromImageOnly,
        });
        await removeCachedCaptionAsync(cacheKey);
      } catch {
        /* ignora falha ao limpar cache */
      }
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              caption: "",
              matchedCatalogId: null,
              reasoning: null,
              isGenerated: false,
              isConfirmed: false,
              isGenerating: false,
              error: null,
            }
          : p
      )
    );
    setRefineInstructions((prev) => ({ ...prev, [postId]: "" }));
    await saveWorkspaceNow();
  };


  // Direct manual modification of look reference link drop-down
  const handleSelectReferenceManual = (postId: string, catalogId: string | null) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const targetRefLabel = referenceCatalog.find((c) => c.id === catalogId)?.label ?? null;
        const revisedCaption = finalizeCaption(p.caption, {
          matchedCatalogId: catalogId,
          matchedLabel: targetRefLabel,
          footer: brandGem.footer,
          captionParams: brandGem.captionParams,
        });

        return {
          ...p,
          matchedCatalogId: catalogId,
          caption: revisedCaption,
          isConfirmed: false
        };
      }
      return p;
    }));
  };

  // Refine single caption with conversational instructions (fora da fila de geração em lote)
  const handleRefineCaption = async (postId: string, instructionOverride?: string) => {
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
        }),
      });

      const result = await readJsonResponse<{ caption?: string; error?: string }>(response);
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível refinar no servidor.");
      }

      noteLastProviderUsed(response.headers.get("X-AI-Provider-Used"));
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
  };

  // Clear single post look image
  const handleClearPostImage = async (postId: string) => {
    if (
      !(await confirmDialog({
        message: "Remover imagem deste dia do planejamento?",
        variant: "danger",
        confirmLabel: "Remover",
      }))
    ) {
      return;
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              image: null,
              imageAssetId: null,
              canvaSlotRef: null,
              matchedCatalogId: null,
              reasoning: null,
              caption: "",
              isGenerated: false,
              isConfirmed: false,
              error: null,
            }
          : p
      )
    );
    await saveWorkspaceNow();
  };

  // Single look reference creation
  const handleCatalogPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const base64 = await fileToCatalogImageDataUrl(file);
      setNewCatalogImage(base64);

      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setNewCatalogLabel(nameWithoutExt);
    }
  };

  const createCatalogItem = async () => {
    if (!newCatalogLabel.trim()) {
      toast.warning("Por favor escreva um código de referência.");
      return;
    }
    if (!newCatalogImage) {
      toast.warning("Por favor envie a foto do look correspondente.");
      return;
    }

    if (useApiStorage && activeClientId) {
      beginSyncDomain("catalog");
      try {
      const blob = await (await fetch(newCatalogImage)).blob();
      const media = await uploadMediaApi(activeClientId, blob, "catalog");
      const itemId = "cat_" + Date.now();
      const res = await fetch(`/api/v1/clients/${activeClientId}/catalog`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auragrid_access_token") ?? ""}`,
        },
        credentials: "include",
        body: JSON.stringify({
          id: itemId,
          label: newCatalogLabel.trim(),
          description: `Inserido em ${new Date().toLocaleDateString("pt-BR")} manualmente.`,
          imageAssetId: media.id,
        }),
      });
      const item = (await res.json()) as CatalogItem;
      setCatalog((prev) => [{ ...item, image: resolveCatalogItemImage(item) }, ...prev]);
      setNewCatalogLabel("");
      setNewCatalogImage(null);
      setShowCatalogModal(false);
      void publishSyncChange(["catalog"]);
      } finally {
        endSyncDomain("catalog");
      }
      return;
    }

    const newItem: CatalogItem = {
      id: "cat_" + Date.now(),
      label: newCatalogLabel.trim(),
      image: newCatalogImage,
      description: `Inserido em ${new Date().toLocaleDateString("pt-BR")} manualmente.`,
      isReference: true,
      enrichmentStatus: "pending",
    };

    setCatalog((prev) => {
      const next = [newItem, ...prev];
      catalogRef.current = next;
      return next;
    });
    setNewCatalogLabel("");
    setNewCatalogImage(null);
    setShowCatalogModal(false);
  };

  const removeCatalogItem = async (id: string) => {
    if (
      !(await confirmDialog({
        message: "Deseja realmente excluir esta referência do acervo cadastrado?",
        variant: "danger",
        confirmLabel: "Excluir",
      }))
    ) {
      return;
    }

    if (useApiStorage && activeClientId) {
      beginSyncDomain("catalog");
      try {
        await deleteCatalogItemApi(activeClientId, id);
        await reloadWorkspaceFromApi();
        setProfileViewItem((current) => (current?.id === id ? null : current));
        void publishSyncChange(["catalog"]);
      } catch (err) {
        console.error("Erro ao excluir item do catálogo:", err);
        toast.error("Não foi possível excluir esta referência na nuvem.");
      } finally {
        endSyncDomain("catalog");
      }
      return;
    }

    setCatalog((prev) => prev.filter((item) => item.id !== id));
    setPosts((prev) =>
      prev.map((p) =>
        p.matchedCatalogId === id ? { ...p, matchedCatalogId: null, isConfirmed: false } : p
      )
    );
    setProfileViewItem((current) => (current?.id === id ? null : current));
  };

  const clearEntireCatalog = useCallback(async () => {
    if (referenceCatalog.length === 0) {
      toast.info("O catálogo já está vazio.");
      return;
    }

    const count = referenceCatalog.length;
    if (
      !(await confirmDialog({
        message: `Excluir todo o catálogo (${count} referência${count === 1 ? "" : "s"})?\n\nTodas as fotos e indexações serão removidas. Vínculos de referência nos roteiros também serão desfeitos.\n\nEsta ação não pode ser desfeita.`,
        variant: "danger",
        confirmLabel: "Excluir tudo",
      }))
    ) {
      return;
    }

    stopCatalogEnrichment();
    if (useApiStorage && activeClientId) {
      beginSyncDomain("catalog");
      try {
        await clearCatalogApi(activeClientId);
        await reloadWorkspaceFromApi();
        setProfileViewItem(null);
        void publishSyncChange(["catalog"]);
      } finally {
        endSyncDomain("catalog");
      }
      return;
    }

    const refIds = new Set(referenceCatalog.map((c) => c.id));
    setCatalog((prev) => prev.filter((c) => !isReferenceCatalogItem(c)));
    setPosts((prev) =>
      prev.map((p) =>
        p.matchedCatalogId && refIds.has(p.matchedCatalogId)
          ? { ...p, matchedCatalogId: null, isConfirmed: false }
          : p
      )
    );
    setProfileViewItem(null);
  }, [referenceCatalog, setCatalog, setPosts]);

  const handleReindexCatalog = async (filter: "failed" | "pending" | "all-incomplete") => {
    const items = referenceCatalog.filter((c) => {
      if (filter === "failed") return c.enrichmentStatus === "failed";
      if (filter === "pending") return c.enrichmentStatus === "pending" || !c.enrichmentStatus;
      return c.enrichmentStatus !== "ready" || !c.visualProfile;
    });
    if (items.length === 0) {
      toast.info("Nenhuma referência para reindexar.");
      return;
    }
    await runCatalogEnrichment(items);
  };

  const indexedCatalogCount = useMemo(
    () => referenceCatalog.filter(isCatalogItemIndexed).length,
    [referenceCatalog]
  );

  const clearableEnrichmentCount = useMemo(
    () => referenceCatalog.filter(hasCatalogEnrichmentData).length,
    [referenceCatalog]
  );

  const clearCatalogEnrichments = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const message =
        ids.length === 1
          ? "Remover a indexação desta referência?\n\nA foto permanece no acervo; só o JSON de visão será apagado."
          : `Remover a indexação de ${ids.length} referências?\n\nAs fotos permanecem; você poderá indexar de novo depois.`;
      if (!(await confirmDialog({ message, variant: "danger", confirmLabel: "Remover indexação" }))) return;

      const idSet = new Set(ids);
      setCatalog((prev) => {
        const next = prev.map((c) =>
          idSet.has(c.id) ? { ...c, ...clearCatalogEnrichmentPatch() } : c
        );
        catalogRef.current = next;
        return next;
      });
      setProfileViewItem((current) => (current && idSet.has(current.id) ? null : current));

      if (useApiStorage && activeClientId) {
        beginSyncDomain("catalog");
        try {
          await clearCatalogEnrichmentsApi(activeClientId, ids);
          await reloadWorkspaceFromApi();
          void publishSyncChange(["catalog"]);
        } catch (err) {
          let clearedOnServer = false;
          try {
            const dto = await fetchWorkspace(activeClientId);
            const ws = apiWorkspaceToClientWorkspace(dto);
            setCatalog(ws.catalog);
            clearedOnServer = ids.every((id) => {
              const item = ws.catalog.find((c) => c.id === id);
              return item && !hasCatalogEnrichmentData(item);
            });
            if (clearedOnServer) {
              void publishSyncChange(["catalog"]);
            }
          } catch {
            /* reload falhou */
          }
          if (!clearedOnServer) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`Não foi possível limpar as indexações no servidor:\n${msg}`);
          }
        } finally {
          endSyncDomain("catalog");
        }
      }
    },
    [setCatalog, useApiStorage, activeClientId, publishSyncChange]
  );

  const clearAllCatalogEnrichments = useCallback(() => {
    const ids = referenceCatalog.filter(hasCatalogEnrichmentData).map((c) => c.id);
    void clearCatalogEnrichments(ids);
  }, [referenceCatalog, clearCatalogEnrichments]);

  const serverEnrichReady = health?.catalogEnrich !== false;

  // Export 7-day plan as formatted TXT file response
  const handleExportTxt = () => {
    let output = `==================================================================\n`;
    output += `👑 AURAGRID INTELLIGENCE - DIAS DE PLANEJAMENTO E LEGENDA DE MODA PREMIUM\n`;
    output += `Exportado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}\n`;
    output += `==================================================================\n\n`;

    posts.forEach((post) => {
      const refItem = referenceCatalog.find((c) => c.id === post.matchedCatalogId);
      const isOk = post.isConfirmed ? "CONCLUÍDO E REVISADO" : "PLANEJAMENTO ANTECIPADO (RASCUNHO)";
      
      const sameDayPosts = posts.filter(p => p.dayNumber === post.dayNumber);
      const postSuffix = sameDayPosts.length > 1 
        ? ` (Postação ${sameDayPosts.indexOf(post) + 1}/${sameDayPosts.length})` 
        : "";
      
      output += `==================================================================\n`;
      output += `📅 DIA ${post.dayNumber}${postSuffix} - ${post.dateLabel.toUpperCase()} [${isOk}]\n`;
      output += `==================================================================\n`;
      output += `👗 Peça do Showroom: ${refItem ? refItem.label : (post.matchedCatalogId || "Manual/Nenhuma")}\n`;
      if (post.reasoning) {
        output += `🧠 Análise de Correlação IA: ${post.reasoning}\n`;
      }
      output += `\n✍️ LEGENDA FORMATADA (Instagram/WhatsApp):\n`;
      output += `------------------------------------------------------------------\n`;
      output += `${post.caption ? post.caption : "(Ainda nenhuma legenda gerada)"}\n`;
      output += `------------------------------------------------------------------\n\n\n`;
    });

    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planejamento-estetico-auragrid.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      const postsForPdf = await Promise.all(
        posts.map(async (post) => {
          const resolved = resolveMediaUrl(post.image) ?? post.image;
          if (!resolved) return post;
          if (resolved.startsWith("/api/")) {
            try {
              const dataUrl = await fetchImageAsDataUrl(resolved);
              return { ...post, image: dataUrl };
            } catch {
              return { ...post, image: resolved };
            }
          }
          return { ...post, image: resolved };
        })
      );

      await exportRoteiroPdf({
        posts: postsForPdf,
        brandName: brandGem.name || activeClient!.name,
        startDate,
        clientSlug: activeClient!.id,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  }, [posts, brandGem.name, activeClient, startDate]);

  const handleExportCanvaGridPdf = useCallback(
    async (scope: "active" | "all") => {
      setIsExportingCanvaPdf(true);
      try {
        await exportCanvaGridPdf({
          pages: canvaPages,
          activePageId: activeCanvaPageId,
          scope,
          brandName: brandGem.name || activeClient!.name,
          clientSlug: activeClient!.id,
          formatMeta: canvaGridFormatMeta,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível gerar o PDF do grid.");
      } finally {
        setIsExportingCanvaPdf(false);
      }
    },
    [
      canvaPages,
      activeCanvaPageId,
      brandGem.name,
      activeClient,
      canvaGridFormatMeta,
    ]
  );

  const { parsedLocation, clientRoute } = useAppNavigation();
  const isDashboardActive = parsedLocation.kind === "dashboard";
  const onClientRoute = parsedLocation.kind === "client";
  const routeSection = clientRoute?.section ?? activeSection;
  const routePostsTab = clientRoute?.postsTab ?? postsWorkTab;
  const routePreviewId = clientRoute?.postId ?? activePreviewId;
  const routeCatalogTab = clientRoute?.catalogTab ?? catalogTab;
  const routeSettingsTab = clientRoute?.settingsTab ?? settingsTab;

  const activePost =
    posts.find((p) => p?.id === routePreviewId) ?? posts.find((p) => !!p?.id) ?? null;

  const orderedEditorialPosts = useMemo(
    () =>
      [...posts].sort((a, b) =>
        a.dayNumber !== b.dayNumber ? a.dayNumber - b.dayNumber : a.id.localeCompare(b.id)
      ),
    [posts]
  );

  const activeEditorialIndex = useMemo(() => {
    const idx = orderedEditorialPosts.findIndex((p) => p.id === routePreviewId);
    return idx >= 0 ? idx : 0;
  }, [orderedEditorialPosts, routePreviewId]);

  const navigateEditorialPost = useCallback(
    (delta: -1 | 1) => {
      const nextIdx = activeEditorialIndex + delta;
      if (nextIdx >= 0 && nextIdx < orderedEditorialPosts.length) {
        selectPreviewPost(orderedEditorialPosts[nextIdx].id);
      }
    },
    [activeEditorialIndex, orderedEditorialPosts, selectPreviewPost]
  );

  return (
    <>
      <AppShell
        activeSection={routeSection}
        isDashboardActive={isDashboardActive}
        onNavigate={handleNavigate}
        onNavigateDashboard={goToDashboard}
        clientName={hasActiveClient ? activeClient.name : "—"}
        catalogCount={referenceCatalog.length}
        brandGemReady={hasActiveClient ? brandGemReady : undefined}
        brandGemMissingCount={hasActiveClient ? brandGemMissingCount : undefined}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onReset={handleResetPresets}
        onClientCreated={(clientId) => void navigateToClientSettings(clientId)}
        hasActiveClient={hasActiveClient}
        footer={<Footer />}
      >
        {connectionStatus === "disconnected" && <ApiAlert />}

        {!hasActiveClient && (
          <div className="flex flex-col items-center justify-center min-h-[45vh] gap-6 px-4 text-center max-w-lg mx-auto">
            <h2 className="font-display text-2xl font-semibold text-ag-text">
              Crie seu primeiro cliente
            </h2>
            <p className="text-sm text-ag-muted">
              Use <strong className="font-medium text-ag-text">+ Novo</strong> na barra lateral
              para cadastrar uma marca. Depois siga o fluxo:
            </p>
            <ol className="text-left text-sm text-ag-muted space-y-2 w-full">
              <li className="flex gap-2">
                <span className="font-bold text-ag-accent shrink-0">1.</span>
                <span>
                  <strong className="text-ag-text">Catálogo</strong> — importe e indexe referências
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-ag-accent shrink-0">2.</span>
                <span>
                  <strong className="text-ag-text">Grid Canva</strong> — monte páginas de 12 fotos
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-ag-accent shrink-0">3.</span>
                <span>
                  <strong className="text-ag-text">Roteiros</strong> — sincronize, gere e aprove
                  legendas
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-ag-accent shrink-0">4.</span>
                <span>
                  <strong className="text-ag-text">Configurações</strong> — configure o Gem da
                  marca
                </span>
              </li>
            </ol>
          </div>
        )}

        {hasActiveClient && isDashboardActive && (
          <DashboardView
            userName={authUser?.displayName ?? authUser?.email}
            activeClient={activeClient}
            clients={clients}
            activeClientId={activeClientId}
            activePeriodLabel={activePeriodLabel}
            isReadOnly={isReadOnly}
            metrics={dashboardMetrics}
            isLoading={useApiStorage && !workspaceHydrated}
            onContinueRoteiro={() =>
              void navigateClient({
                clientId: effectiveActiveClientId,
                section: "posts",
                postsTab: "day",
              })
            }
            onNavigateSection={(section) =>
              void navigateClient({ clientId: effectiveActiveClientId, section })
            }
            onSelectClient={(clientId) => {
              if (clientId !== activeClientId) switchClient(clientId);
            }}
            onConfigureGem={() =>
              void navigateClient({
                clientId: effectiveActiveClientId,
                section: "settings",
                settingsTab: "brand",
              })
            }
            onClientCreated={(clientId) => void navigateToClientSettings(clientId)}
          />
        )}

        {hasActiveClient && parsedLocation.kind === "welcome" && (
          <div className="flex flex-col items-center justify-center min-h-[45vh] gap-6 px-4 text-center max-w-lg mx-auto">
            <h2 className="font-display text-2xl font-semibold text-ag-text">
              Bem-vindo ao AuraGrid
            </h2>
            <p className="text-sm text-ag-muted">
              Você já tem clientes cadastrados. Entre no workspace para continuar de onde parou.
            </p>
            <Button
              variant="accent"
              size="lg"
              onClick={() =>
                void navigateClient({
                  clientId: effectiveActiveClientId,
                  section: "posts",
                  postsTab: "day",
                })
              }
            >
              Ir para o workspace
            </Button>
          </div>
        )}

        {hasActiveClient && onClientRoute && routeSection === "settings" && (
          <ConfigPanel
            variant="page"
            clientName={activeClient.name}
            brandGem={brandGem}
            brandGemSavedAt={workspace.ui?.brandGemSavedAt}
            onSaveBrandGem={saveBrandGem}
            onDirtyChange={setSettingsDraftDirty}
            settingsTab={routeSettingsTab}
            onSettingsTabChange={handleSettingsTabChange}
          />
        )}

        {hasActiveClient && onClientRoute && routeSection === "posts" && (
          <div className="ag-workspace-section">
            <PostsWorkflowBar stats={captionBatchStats} />

            <PlanningPeriodSelector
              periods={planningPeriods}
              activePeriodId={activePlanningPeriodId}
              isReadOnly={isReadOnly}
              hideDuplicateAction={isReadOnly}
              onSelect={(periodId) => {
                void navigateClient({ periodId }, { replace: true, skipDirtyGuard: true });
              }}
              onCreateNew={() => {
                setDuplicateSourcePeriodId(undefined);
                setShowNewPlanningPeriodModal(true);
              }}
              onDuplicate={(sourceId) => {
                setDuplicateSourcePeriodId(sourceId);
                setShowNewPlanningPeriodModal(true);
              }}
              toolbar={
                <PostsWorkspaceToolbar
                  activeTab={routePostsTab}
                  onTabChange={handlePostsWorkTabChange}
                  onExportTxt={handleExportTxt}
                  onExportPdf={handleExportPdf}
                  isExportingPdf={isExportingPdf}
                />
              }
            />

            {isReadOnly && (
              <PlanningPeriodReadOnlyBanner
                periodLabel={activePeriodLabel}
                onDuplicate={() => {
                  setDuplicateSourcePeriodId(activePlanningPeriodId);
                  setShowNewPlanningPeriodModal(true);
                }}
              />
            )}

            {routePostsTab === "setup" && (
              <PopularCalendarioPanel
                startDate={startDate}
                onStartDateChange={handleStartDateChange}
                postsCount={posts.length}
                onAddDay={handleAddDay}
                onBatchUpload={(files) => handleBatchScheduleUpload(files)}
                isReadOnly={isReadOnly}
                autoSync={autoSyncCanva}
                onAutoSyncChange={(enabled) => {
                  setAutoSyncCanva(enabled);
                  if (enabled) syncCanvaGridToTimeline(canvaPages, true);
                }}
                canvaGridReversed={canvaGridReversed}
                onCanvaGridReversedChange={(reversed) => {
                  setCanvaGridReversed(reversed);
                  setTimeout(() => {
                    if (autoSyncCanva) syncCanvaGridToTimeline(canvaPages, false);
                  }, 50);
                }}
                onSyncNow={() => syncCanvaGridToTimeline(canvaPages, true)}
                canvaImageCount={canvaImageCount}
                onOpenCanvaGrid={() => void handleNavigate("canva_grid")}
                distributionPrefs={distributionPrefs}
                onDistributionPrefsChange={updateDistributionPrefs}
                onDistributeFromGrid={handleDistributeFromGrid}
              />
            )}

            {postsWorkTab !== "setup" && (
              <div className="sticky top-[var(--ag-topbar-height)] z-10 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-ag-bg/90 backdrop-blur-sm border-b border-ag-border/40">
                <CaptionBatchPanel
                  stats={captionBatchStats}
                  isRunning={isProcessingAll}
                  progress={captionBatchProgress}
                  brandGemReady={brandGemReady}
                  brandGemMissingFields={brandGemMissingFields}
                  onOpenGemSettings={() => void handleNavigate("settings")}
                  onGeneratePending={handleRunAllMatching}
                  onRegenerateErrors={handleRegenerateCaptionErrors}
                  onStop={stopCaptionBatch}
                  onReviewAll={() => handlePostsWorkTabChange("calendar")}
                  compact
                />
              </div>
            )}

            {routePostsTab === "calendar" && (
              <TimelineStrip
                posts={posts}
                catalog={referenceCatalog}
                activePreviewId={activePreviewId}
                swapSourceId={swapSourceId}
                reorderMode={timelineReorderMode}
                onEnterReorderMode={() => setTimelineReorderMode(true)}
                onCancelReorder={cancelTimelineReorder}
                onSelectPost={handleScrollToDay}
                onSwapClick={(id) => {
                  if (swapSourceId === id) {
                    setSwapSourceId("");
                    return;
                  }
                  if (swapSourceId) {
                    handleSwapDays(swapSourceId, id);
                  } else {
                    setSwapSourceId(id);
                    toast.info("Origem selecionada! Escolha outro post para inverter os conteúdos.");
                  }
                }}
              />
            )}

            {routePostsTab === "day" && posts.length > 0 && (
              <TimelineStrip
                posts={posts}
                catalog={referenceCatalog}
                activePreviewId={activePreviewId}
                swapSourceId={swapSourceId}
                reorderMode={timelineReorderMode}
                onEnterReorderMode={() => setTimelineReorderMode(true)}
                onCancelReorder={cancelTimelineReorder}
                onSelectPost={handleScrollToDay}
                onSwapClick={(id) => {
                  if (swapSourceId === id) {
                    setSwapSourceId("");
                    return;
                  }
                  if (swapSourceId) {
                    handleSwapDays(swapSourceId, id);
                  } else {
                    setSwapSourceId(id);
                    toast.info("Origem selecionada! Escolha outro post para inverter os conteúdos.");
                  }
                }}
              />
            )}

            {routePostsTab === "day" && activePost ? (
              <PostDayStudio
                cardRef={(el) => {
                  dayCardRefs.current[activePost.id] = el;
                }}
                post={activePost}
                position={activeEditorialIndex + 1}
                total={orderedEditorialPosts.length}
                status={getPostStatus(activePost)}
                referenceCatalog={referenceCatalog}
                postDragOver={!!postDragOver[activePost.id]}
                copiedId={copiedId}
                refineInstruction={refineInstructions[activePost.id] || ""}
                isRefining={!!isRefining[activePost.id]}
                brandGemReady={brandGemReady}
                captionMaxMainChars={captionGenerationParams.maxHookChars}
                captionFooter={brandGem.footer}
                profileHandle={
                  activeClient.instagramHandle ?? activeClient.id.replace(/-/g, "_")
                }
                hasPrevious={activeEditorialIndex > 0}
                hasNext={activeEditorialIndex < orderedEditorialPosts.length - 1}
                onPrevious={() => navigateEditorialPost(-1)}
                onNext={() => navigateEditorialPost(1)}
                onAddPostToDay={() => handleAddNewPostToDay(activePost.dayNumber)}
                onRemove={() => handleRemovePost(activePost.id)}
                onToggleConfirm={() => handleToggleConfirm(activePost.id)}
                onPhotoUpload={async (file) => handlePostPhotoUpload(activePost.id, file)}
                onClearImage={() => handleClearPostImage(activePost.id)}
                onSelectReference={(id) => handleSelectReferenceManual(activePost.id, id)}
                onToggleCaptionFromImageOnly={(enabled) =>
                  handleToggleCaptionFromImageOnly(activePost.id, enabled)
                }
                onGenerate={() =>
                  matchAndGenerateForPost(activePost.id, { force: activePost.isGenerated })
                }
                onStopGenerate={() => stopCaptionGeneration(activePost.id)}
                onCopyCaption={() => handleCopy(activePost.id, activePost.caption)}
                onCaptionChange={(v) => updateCaptionBodyManual(activePost.id, v)}
                onClearCaption={() => void handleClearCaption(activePost.id)}
                onRefineInstructionChange={(v) =>
                  setRefineInstructions((prev) => ({ ...prev, [activePost.id]: v }))
                }
                onRefine={(instruction) => void handleRefineCaption(activePost.id, instruction)}
              />
            ) : routePostsTab === "day" ? (
              <div className="ag-card p-8 text-center text-sm text-ag-muted">
                Nenhum post no roteiro. Use a aba <strong>Setup</strong> para popular o calendário.
              </div>
            ) : routePostsTab === "calendar" ? (
              <EditorialGridView
                posts={posts}
                referenceCatalog={referenceCatalog}
                activePreviewId={activePreviewId}
                postDragOver={postDragOver}
                copiedId={copiedId}
                refineInstructions={refineInstructions}
                isRefining={isRefining}
                brandGemReady={brandGemReady}
                onAddPostToDay={handleAddNewPostToDay}
                onRemove={handleRemovePost}
                onToggleConfirm={handleToggleConfirm}
                onCopy={handleCopy}
                onPhotoUpload={(postId, file) => handlePostPhotoUpload(postId, file)}
                onClearImage={handleClearPostImage}
                onSelectReference={handleSelectReferenceManual}
                onToggleCaptionFromImageOnly={handleToggleCaptionFromImageOnly}
                onGenerate={(postId) => {
                  const p = posts.find((x) => x.id === postId);
                  return matchAndGenerateForPost(postId, { force: !!p?.isGenerated });
                }}
                onStopGenerate={stopCaptionGeneration}
                onCaptionChange={updateCaptionBodyManual}
                onClearCaption={(postId) => void handleClearCaption(postId)}
                onRefineInstructionChange={(postId, v) =>
                  setRefineInstructions((prev) => ({ ...prev, [postId]: v }))
                }
                onRefine={(postId, instruction) => void handleRefineCaption(postId, instruction)}
                onFocusPost={(id) => selectPreviewPost(id)}
                onOpenStudio={(id) => {
                  selectPreviewPost(id);
                  handlePostsWorkTabChange("day");
                }}
              />
            ) : null}
          </div>
        )}

        {hasActiveClient && onClientRoute && routeSection === "canva_grid" && activeCanvaPage && (
          <StudioSection
            titleMode="hidden"
            actions={
              <>
                <Button
                  variant="accent"
                  size="sm"
                  disabled={isExportingCanvaPdf}
                  onClick={() => void handleExportCanvaGridPdf("all")}
                >
                  {isExportingCanvaPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  {isExportingCanvaPdf ? "Gerando PDF…" : "Exportar PDF"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isExportingCanvaPdf}
                  onClick={() => void handleExportCanvaGridPdf("active")}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF página ativa
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => {
                    void (async () => {
                      if (
                        !(await confirmDialog({
                          message: "Aplicar a sequência desta página ao calendário de 30 dias?",
                          confirmLabel: "Aplicar",
                        }))
                      ) {
                        return;
                      }
                      handlePlanFromCanva("active", true);
                      toast.success("Calendário atualizado com o bloco ativo.");
                      void handleNavigate("posts");
                    })();
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Aplicar página ativa
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void (async () => {
                      if (
                        !(await confirmDialog({
                          message: "Aplicar todas as páginas ao cronograma de 30 dias?",
                          confirmLabel: "Aplicar",
                        }))
                      ) {
                        return;
                      }
                      handlePlanFromCanva("all", true);
                      toast.success("Calendário atualizado com todas as páginas.");
                      void handleNavigate("posts");
                    })();
                  }}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Todas as páginas
                </Button>
              </>
            }
          >
            <p className="text-sm text-ag-muted mb-4 leading-relaxed max-w-3xl">
              Monte páginas de 12 fotos, organize looks e envie para o roteiro de 30 dias.{" "}
              <CanvaGridOrderHint onOpenRoteiros={() => void handleNavigate("posts")} />
            </p>
            <CanvaGridWorkspace
              pages={canvaPages}
              activePage={activeCanvaPage}
              activePageId={activeCanvaPageId}
              selectedSlotId={selectedCanvaSlotId}
              selectedSlotNumber={selectedCanvaSlotNumber}
              canvaSlotDragOver={canvaSlotDragOver}
              canvaGridFormat={canvaGridFormat}
              canvaGridFormatMeta={canvaGridFormatMeta}
              canvaGridMaxWidth={canvaGridMaxWidth}
              wardrobeItems={canvaCatalog}
              catalogUsageOnActivePage={catalogUsageOnActivePage}
              cloudSave={useApiStorage}
              onSelectPage={(id) => selectCanvaPage(id)}
              onAddPage={handleAddCanvaPage}
              onDeletePage={handleDeleteCanvaPage}
              onDuplicatePage={handleDuplicateCanvaPage}
              onClearPage={handleClearCanvaPage}
              onReorderPages={handleReorderCanvaPages}
              onBatchUpload={handleBatchUploadToCanva}
              onSelectSlot={(slotId) => selectCanvaSlot(slotId)}
              onClearSlotSelection={() => selectCanvaSlot(null)}
              onSwapSlots={(a, b) => handleSwapCanvaSlots(activeCanvaPage!.id, a, b)}
              onClearSlotImage={(slotId) =>
                handleAssignCatalogToCanvaSlot(activeCanvaPage!.id, slotId, null)
              }
              onUploadSlot={(slotId, file) =>
                void handleUploadImageToCanvaSlot(activeCanvaPage!.id, slotId, file)
              }
              onDropOnSlot={async (slotId, dt) => {
                setCanvaSlotDragOver(null);
                await handleDropOnCanvaSlot(activeCanvaPage!.id, slotId, dt);
              }}
              onSlotDragOver={setCanvaSlotDragOver}
              onSlotDragLeave={(id) =>
                setCanvaSlotDragOver((prev) => (prev === id ? null : prev))
              }
              onOpenLightbox={(slot, num) => {
                const image = resolveSlotImage(slot);
                if (image) {
                  setCanvaLightbox({ image, label: slot.label, slotNumber: num });
                }
              }}
              onFormatChange={setCanvaGridFormat}
              onZoomChange={setCanvaGridMaxWidth}
              onAssignWardrobeItem={(item) => {
                const page = activeCanvaPage!;
                if (selectedCanvaSlotId) {
                  handleAssignCatalogToCanvaSlot(page.id, selectedCanvaSlotId, item);
                  return;
                }
                const firstEmptySlot = [...page.slots].reverse().find((s) => s.image === null);
                if (firstEmptySlot) {
                  handleAssignCatalogToCanvaSlot(page.id, firstEmptySlot.id, item);
                } else {
                  toast.warning(
                    "Não há espaços vazios nesta página! Selecione um slot para substituir."
                  );
                }
              }}
              onOpenCatalog={() => void handleNavigate("catalog")}
            />
            {canvaLightbox && (
              <CanvaGridLightbox
                image={canvaLightbox.image}
                label={canvaLightbox.label}
                slotNumber={canvaLightbox.slotNumber}
                onClose={() => setCanvaLightbox(null)}
              />
            )}
          </StudioSection>
        )}

        {/* WORKSPACE VIEW 2: FEED GRID HARMONY SIMULATOR (Instagram 3x3) */}
        {hasActiveClient && onClientRoute && routeSection === "feed_simulator" && (
          <FeedInstagramPreview
            posts={posts}
            profileDisplayName={brandGem.name}
            profileHandle={
              activeClient.instagramHandle ?? activeClient.id.replace(/-/g, "_")
            }
            activePreviewId={activePreviewId}
            swapSourceId={swapSourceId}
            onSelectPost={handleScrollToDay}
            onSwapDays={handleSwapDays}
            onOpenStudio={() => {
              handlePostsWorkTabChange("day");
              void handleNavigate("posts");
            }}
          />
        )}

        {hasActiveClient && onClientRoute && routeSection === "reference_finder" && (
          <ReferenceFinderPanel
            referenceCatalog={referenceCatalog}
            isEnrichingCatalog={isEnrichingCatalog}
            onNavigateCatalog={() => void handleNavigate("catalog")}
            onEnsureCatalogIndexed={ensureCatalogIndexedForMatch}
            onViewProfile={(item) => setProfileViewItem(item)}
            clientId={useApiStorage ? activeClientId ?? undefined : undefined}
          />
        )}

        {/* WORKSPACE VIEW 3: REFERENCE CLOTHES BATCH FILES MANAGER */}
        {hasActiveClient && onClientRoute && routeSection === "catalog" && (
          <StudioSection
            titleMode="hidden"
            eyebrow="Acervo"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => void handleNavigate("canva_grid")}>
                  <LayoutGrid className="h-4 w-4" />
                  Usar no Grid Canva
                </Button>
                <Button variant="accent" size="sm" onClick={() => setShowCatalogModal(true)}>
                  <Plus className="h-4 w-4" />
                  Nova referência
                </Button>
                {referenceCatalog.length > 0 && routeCatalogTab === "references" && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={clearEntireCatalog}
                    disabled={isEnrichingCatalog}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir catálogo
                  </Button>
                )}
              </div>
            }
          >
            <p className="text-sm text-ag-muted leading-relaxed max-w-3xl mb-4">
              Referências indexadas para match de IA e peças visuais para o Grid Canva.
              {!serverEnrichReady && (
                <span className="block mt-2 text-ag-danger text-xs p-2 rounded-lg bg-ag-danger/10 border border-ag-danger/25">
                  Reinicie com <strong>npm run dev</strong> para ativar indexação.
                </span>
              )}
              {isEnrichingCatalog && (
                <span className="flex items-center gap-2 mt-2 text-ag-accent text-xs">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span className="min-w-0">{catalogEnrichProgressLabel}</span>
                  <button
                    type="button"
                    onClick={stopCatalogEnrichment}
                    className="font-semibold text-ag-danger cursor-pointer"
                  >
                    Parar
                  </button>
                </span>
              )}
            </p>
            <CatalogTabNav
              active={routeCatalogTab}
              onChange={handleCatalogTabChange}
              referenceCount={referenceCatalog.length}
              gridCount={gridCatalog.length}
            />

            {routeCatalogTab === "references" && (
              <>
            <div className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-4 mb-8 ${
              catalogDragOver 
                ? "border-ag-accent bg-ag-accent/5 rotate-0 scale-99" 
                : "border-ag-border hover:border-ag-border bg-ag-surface-2/40 hover:bg-ag-surface-2"
            }`}
              onDragOver={(e) => {
                e.preventDefault();
                setCatalogDragOver(true);
              }}
              onDragLeave={() => {
                setCatalogDragOver(false);
              }}
              onDrop={async (e) => {
                e.preventDefault();
                setCatalogDragOver(false);
                const files = await collectFilesFromDataTransfer(e.dataTransfer);
                if (files.length > 0) {
                  await handleBatchImages(files, { asReference: true });
                } else {
                  toast.warning(
                    "Não foi possível ler a pasta arrastada. Use o botão «Subir Pasta de Referências» ou arraste arquivos de imagem."
                  );
                }
              }}
            >
              
              <div className="p-4 bg-ag-accent/10 rounded-full text-ag-accent">
                <FolderOpen className="h-8 w-8 text-ag-accent" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-ag-text">
                  Importar Pasta de Ativos ou Seleção de Imagens em Lote
                </h3>
                <p className="text-xs text-ag-muted max-w-md mx-auto mt-1 leading-relaxed">
                  <strong className="text-ag-text font-medium">Arraste a pasta</strong> para esta área (recomendado).
                  Cada subpasta é um código (ex: <code>#00874</code>) e{" "}
                  <strong className="text-ag-text font-medium">todas as fotos</strong> dentro dela viram referências.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                {/* Single or Multiple File Trigger */}
                <button
                  type="button"
                  disabled={isUploadingCatalog || isEnrichingCatalog}
                  onClick={() => filesUploadInputRef.current?.click()}
                  className="bg-ag-surface-3 hover:bg-ag-surface-3/80 border border-ag-border text-ag-text text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
                >
                  <ImageIcon className="h-4 w-4 text-ag-accent" />
                  <span>Selecionar Vários Arquivos</span>
                </button>

                {/* Directory Upload Trigger */}
                <button
                  type="button"
                  disabled={isUploadingCatalog || isEnrichingCatalog}
                  onClick={() => void openReferenceFolderPicker()}
                  className="bg-ag-surface-3 hover:bg-ag-surface-3/80 border border-ag-border text-ag-text text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
                >
                  <FolderOpen className="h-4 w-4 text-ag-accent" />
                  <span>Subir Pasta de Referências</span>
                </button>

              </div>

              <p className="text-[10.5px] text-ag-muted max-w-md mx-auto -mt-2 leading-relaxed">
                Pelo botão: selecione a pasta <strong className="text-ag-text font-medium">Fotos(6)</strong> inteira.
                O navegador pedirá «Fazer upload» — clique em confirmar.
                Prefira <strong className="text-ag-text font-medium">arrastar a pasta</strong> na área acima.
              </p>

              {/* Hidden Inputs of batch triggers */}
              <input
                type="file"
                id="batch-files-picker"
                accept="image/*"
                multiple
                ref={filesUploadInputRef}
                className="hidden"
                onChange={handleFilesUploadChange}
              />

              <input
                type="file"
                id="batch-folder-picker"
                multiple
                ref={bindFolderUploadInput}
                className="hidden"
                tabIndex={-1}
                aria-hidden
              />

            </div>

            {/* Catalog list Render */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-ag-border">
              <div>
                <span className="text-xs font-bold font-mono uppercase tracking-widest text-ag-muted">
                  Looks Referenciados Ativos ({referenceCatalog.length})
                </span>
                <span className="text-[10.5px] text-ag-muted block mt-0.5">
                  {referenceCatalog.filter((c) => c.enrichmentStatus === "ready").length} indexados ·{" "}
                  {referenceCatalog.filter((c) => c.enrichmentStatus === "failed").length} com erro ·{" "}
                  {referenceCatalog.filter((c) => c.enrichmentStatus !== "ready" && c.enrichmentStatus !== "failed").length} pendentes
                  {isEnrichingCatalog && (
                    <span className="block mt-1 text-ag-accent font-medium">
                      {catalogEnrichProgressLabel}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {isEnrichingCatalog && (
                  <button
                    type="button"
                    onClick={stopCatalogEnrichment}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-ag-danger/35 bg-ag-danger/10 text-ag-danger hover:bg-ag-danger/15 cursor-pointer flex items-center gap-1"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Parar indexação
                  </button>
                )}
                {referenceCatalog.some((c) => c.enrichmentStatus === "failed") && (
                  <button
                    type="button"
                    disabled={isEnrichingCatalog}
                    onClick={() => void handleReindexCatalog("failed")}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-ag-danger/30 bg-ag-danger/10 text-ag-danger hover:bg-ag-danger/15 disabled:opacity-50 cursor-pointer"
                  >
                    Reindexar falhas
                  </button>
                )}
                {referenceCatalog.some(
                  (c) => c.enrichmentStatus !== "ready" && c.enrichmentStatus !== "failed"
                ) && (
                  <button
                    type="button"
                    disabled={isEnrichingCatalog}
                    onClick={() => void handleReindexCatalog("all-incomplete")}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-ag-border bg-ag-surface-2 text-ag-text hover:bg-ag-surface-3 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  >
                    {isEnrichingCatalog && <RefreshCw className="h-3 w-3 animate-spin" />}
                    Indexar pendentes
                  </button>
                )}
                {clearableEnrichmentCount > 0 && (
                  <button
                    type="button"
                    disabled={isEnrichingCatalog}
                    onClick={() => clearAllCatalogEnrichments()}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-ag-border bg-ag-surface-2 text-ag-muted hover:text-ag-danger hover:border-ag-danger/30 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                    title="Apaga o JSON de visão; as fotos do acervo permanecem"
                  >
                    <Eraser className="h-3 w-3" />
                    Limpar indexações ({clearableEnrichmentCount})
                  </button>
                )}
                {indexedCatalogCount > 0 && indexedCatalogCount < clearableEnrichmentCount && (
                  <button
                    type="button"
                    disabled={isEnrichingCatalog}
                    onClick={() =>
                      void clearCatalogEnrichments(
                        referenceCatalog.filter(isCatalogItemIndexed).map((c) => c.id)
                      )
                    }
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-ag-border/80 bg-transparent text-ag-muted hover:text-ag-danger disabled:opacity-50 cursor-pointer"
                    title="Só referências com JSON ✓"
                  >
                    Só indexados ({indexedCatalogCount})
                  </button>
                )}
              </div>
            </div>

            {referenceCatalog.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-ag-surface-2 border border-ag-border">
                <ImageIcon className="h-8 w-8 text-ag-muted mx-auto animate-pulse mb-1" />
                <p className="text-xs font-semibold text-ag-muted">Nenhuma referência no acervo</p>
                <p className="text-[10px] text-ag-muted mt-1">
                  Use &quot;Subir Pasta de Referências&quot; ou &quot;Adicionar Único&quot; para cadastrar looks que a IA usará no match dos roteiros.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {referenceCatalog.map((item) => {
                  const catalogIndexed = isCatalogItemIndexed(item);
                  const showIndexButton = !catalogIndexed;
                  const canClearEnrichment = hasCatalogEnrichmentData(item);
                  const isIndexingThis =
                    item.enrichmentStatus === "processing" ||
                    (isEnrichingCatalog && catalogEnrichProgress?.itemId === item.id);

                  return (
                  <div 
                    key={item.id}
                    className="border rounded-2xl p-3 flex flex-col gap-2.5 relative group transition-all shadow-xs bg-ag-surface-2 border-ag-border hover:border-ag-border"
                  >
                    
                    {/* Visual aspect */}
                    <div className="aspect-[3/4] rounded-xl overflow-hidden relative flex items-center justify-center border transition-colors bg-ag-surface-1 border-ag-border group/img">
                      <button
                        type="button"
                        disabled={!item.image}
                        onClick={() => {
                          if (item.image) {
                            setCatalogLightbox({ image: item.image, label: item.label });
                          }
                        }}
                        className="w-full h-full flex items-center justify-center p-1.5 cursor-zoom-in disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-ag-accent/50 rounded-xl"
                        title="Ampliar imagem"
                      >
                        <CatalogThumbnail
                          src={item.image}
                          alt={item.label}
                          imgClassName="object-contain pointer-events-none"
                        />
                        {item.image && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/img:bg-black/35 transition-colors opacity-0 group-hover/img:opacity-100 pointer-events-none">
                            <ZoomIn className="h-6 w-6 text-white drop-shadow-md" />
                          </span>
                        )}
                      </button>
                      
                      {/* Delete look trigger */}
                      <span
                        className={`absolute top-1.5 left-1.5 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md border ${
                          catalogIndexed
                            ? "bg-ag-success/15 text-ag-success border-ag-success/30"
                            : item.enrichmentStatus === "processing"
                              ? "bg-ag-warning/15 text-ag-warning border-ag-warning/30"
                              : item.enrichmentStatus === "failed"
                                ? "bg-ag-danger/15 text-ag-danger border-ag-danger/30"
                                : "bg-ag-surface-3 text-ag-muted border-ag-border"
                        }`}
                      >
                        {catalogIndexed
                          ? "JSON ✓"
                          : item.enrichmentStatus === "processing"
                            ? "…"
                            : item.enrichmentStatus === "failed"
                              ? "Erro"
                              : "Pend."}
                      </span>

                      <button
                        onClick={() => removeCatalogItem(item.id)}
                        className="absolute top-1.5 right-1.5 bg-ag-bg/90 p-1.5 rounded-lg hover:bg-ag-danger hover:text-white text-ag-muted opacity-0 group-hover:opacity-100 transition-all cursor-pointer border border-ag-border"
                        title="Excluir do catálogo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Metadata text inputs */}
                    <div className="font-sans min-w-0">
                      <span className="text-xs font-bold text-center uppercase block truncate text-ag-accent dark:text-ag-accent" title={item.label}>
                        {item.label}
                      </span>
                      {item.enrichmentError && item.enrichmentStatus === "failed" && (
                        <span
                          className="text-[9px] text-ag-danger text-center block mt-0.5 line-clamp-2"
                          title={item.enrichmentError}
                        >
                          {item.enrichmentError}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      {catalogIndexed && (
                        <button
                          type="button"
                          onClick={() => setProfileViewItem(item)}
                          className="w-full text-[10px] font-bold py-1.5 rounded-lg border border-ag-accent/25 bg-ag-accent/10 text-ag-accent hover:bg-ag-accent/15 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          Ver perfil
                        </button>
                      )}
                      {canClearEnrichment && !isIndexingThis && (
                        <button
                          type="button"
                          disabled={isEnrichingCatalog}
                          onClick={() => void clearCatalogEnrichments([item.id])}
                          className="w-full text-[10px] font-medium py-1 rounded-lg border border-transparent text-ag-muted hover:text-ag-danger hover:border-ag-danger/20 hover:bg-ag-danger/5 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                          title="Apagar só o JSON de visão; a foto permanece"
                        >
                          <Eraser className="h-3 w-3" />
                          Limpar indexação
                        </button>
                      )}
                      {showIndexButton && (
                        <button
                          type="button"
                          disabled={isIndexingThis}
                          onClick={() =>
                            void runCatalogEnrichment([item])
                          }
                          className="w-full text-[10px] font-bold py-1.5 rounded-lg border border-ag-border bg-ag-surface-1 text-ag-muted hover:text-ag-text disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${isIndexingThis ? "animate-spin" : ""}`}
                          />
                          {isIndexingThis
                            ? "Indexando…"
                            : item.enrichmentStatus === "failed"
                              ? "Tentar de novo"
                              : "Indexar"}
                        </button>
                      )}
                    </div>

                  </div>
                  );
                })}
              </div>
            )}

              </>
            )}

            {routeCatalogTab === "grid" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-ag-text flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-ag-accent" />
                    Peças de grid ({gridCatalog.length})
                  </h3>
                  <p className="text-[11px] text-ag-muted mt-0.5 max-w-xl">
                    Banners, lifestyle e composições para o feed — ficam no acervo junto com os looks,
                    mas <strong className="text-ag-text font-semibold">não entram na indexação nem no match da IA</strong>.
                  </p>
                </div>
                {gridCatalog.length > 0 && (
                  <button
                    type="button"
                    onClick={clearGridCatalog}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-ag-danger/35 bg-ag-danger/10 text-ag-danger hover:bg-ag-danger/15 cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Excluir peças de grid
                  </button>
                )}
              </div>

              <div
                className={`p-5 sm:p-6 border-2 border-dashed rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-3 mb-6 ${
                  gridCatalogDragOver
                    ? "border-ag-accent/60 bg-ag-accent/5"
                    : "border-ag-border hover:border-ag-accent/30 bg-ag-surface-2/30"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setGridCatalogDragOver(true);
                }}
                onDragLeave={() => setGridCatalogDragOver(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setGridCatalogDragOver(false);
                  const files = await collectFilesFromDataTransfer(e.dataTransfer);
                  if (files.length) await handleBatchImages(files, { asReference: false });
                }}
              >
                <div className="p-3 bg-ag-accent-soft rounded-full text-ag-accent">
                  <LayoutGrid className="h-6 w-6" />
                </div>
                <p className="text-xs text-ag-muted max-w-md">
                  Arraste banners, capas de coleção ou fotos de ambiente (ex.: tile 1/3 de um carrossel).
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => gridFilesUploadInputRef.current?.click()}
                    className="bg-ag-surface-3 hover:bg-ag-surface-3/80 border border-ag-border text-ag-text text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer"
                  >
                    <ImageIcon className="h-4 w-4 text-ag-accent" />
                    Selecionar arquivos
                  </button>
                  <button
                    type="button"
                    onClick={() => void openGridFolderPicker()}
                    className="bg-ag-surface-3 hover:bg-ag-surface-3/80 border border-ag-border text-ag-text text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer"
                  >
                    <FolderOpen className="h-4 w-4 text-ag-accent" />
                    Subir pasta
                  </button>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={gridFilesUploadInputRef}
                  className="hidden"
                  onChange={handleGridFilesUploadChange}
                />
                <input
                  type="file"
                  multiple
                  ref={bindGridFolderUploadInput}
                  className="hidden"
                  tabIndex={-1}
                  aria-hidden
                />
              </div>

              {gridCatalog.length === 0 ? (
                <EmptyState
                  icon={LayoutGrid}
                  title="Nenhuma peça de grid"
                  description="Banners, lifestyle e composições para o feed — arraste arquivos na área acima."
                  compact
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {gridCatalog.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-2xl p-3 flex flex-col gap-2 relative group bg-ag-surface-2 border-ag-border hover:border-ag-accent/30 transition-all"
                    >
                      <div className="aspect-[3/4] rounded-xl overflow-hidden relative flex items-center justify-center bg-ag-surface-1 border border-ag-border group/img">
                        <button
                          type="button"
                          disabled={!item.image}
                          onClick={() => {
                            if (item.image) {
                              setCatalogLightbox({ image: item.image, label: item.label });
                            }
                          }}
                          className="w-full h-full flex items-center justify-center p-1.5 cursor-zoom-in disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-ag-accent/50 rounded-xl"
                          title="Ampliar imagem"
                        >
                          <CatalogThumbnail
                            src={item.image}
                            alt={item.label}
                            imgClassName="object-contain pointer-events-none"
                          />
                          {item.image && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/img:bg-black/35 transition-colors opacity-0 group-hover/img:opacity-100 pointer-events-none">
                              <ZoomIn className="h-6 w-6 text-white drop-shadow-md" />
                            </span>
                          )}
                        </button>
                        <span className="absolute top-1.5 left-1.5 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md border bg-ag-accent-soft text-ag-accent border-ag-accent/30">
                          Grid
                        </span>
                        <button
                          onClick={() => removeCatalogItem(item.id)}
                          className="absolute top-1.5 right-1.5 bg-ag-bg/90 p-1.5 rounded-lg hover:bg-ag-danger hover:text-white text-ag-muted opacity-0 group-hover:opacity-100 transition-all cursor-pointer border border-ag-border"
                          title="Excluir peça de grid"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span
                        className="text-xs font-bold text-center uppercase truncate text-ag-accent"
                        title={item.label}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

          </StudioSection>
        )}

      </AppShell>

      <CatalogUploadProgressPanel
        progress={catalogUploadProgress}
        onCancel={isUploadingCatalog ? cancelCatalogUpload : undefined}
        onDismiss={() => {
          if (catalogUploadDismissRef.current) {
            clearTimeout(catalogUploadDismissRef.current);
            catalogUploadDismissRef.current = null;
          }
          setCatalogUploadProgress(null);
        }}
      />

      <CatalogEnrichProgressPanel
        progress={catalogEnrichProgress}
        isEnriching={isEnrichingCatalog}
        onStop={isEnrichingCatalog ? stopCatalogEnrichment : undefined}
      />

      <CatalogProfileModal
        item={profileViewItem}
        onClose={() => setProfileViewItem(null)}
      />

      {catalogLightbox && (
        <CanvaGridLightbox
          image={catalogLightbox.image}
          label={catalogLightbox.label}
          onClose={() => setCatalogLightbox(null)}
        />
      )}

      <CatalogModal
        open={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        label={newCatalogLabel}
        onLabelChange={setNewCatalogLabel}
        image={newCatalogImage}
        dragOver={catalogDragOver}
        onDragOver={(e) => {
          e.preventDefault();
          setCatalogDragOver(true);
        }}
        onDragLeave={() => setCatalogDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setCatalogDragOver(false);
          const files = e.dataTransfer.files;
          if (files?.length) {
            const file = files[0];
            const base64 = await fileToCatalogImageDataUrl(file);
            setNewCatalogImage(base64);
            const nameWithoutExt =
              file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
            setNewCatalogLabel(nameWithoutExt);
          }
        }}
        onPickFile={() => catalogFileInputRef.current?.click()}
        onSave={createCatalogItem}
      />

      <NewPlanningPeriodModal
        open={showNewPlanningPeriodModal}
        onClose={() => {
          setShowNewPlanningPeriodModal(false);
          setDuplicateSourcePeriodId(undefined);
        }}
        periods={planningPeriods}
        defaultSourcePeriodId={duplicateSourcePeriodId}
        onSubmit={async (options) => {
          await createPlanningPeriod(options);
        }}
      />

      <input
        type="file"
        accept="image/*"
        ref={catalogFileInputRef}
        className="hidden"
        onChange={handleCatalogPhotoUpload}
      />

    </>
  );
}
