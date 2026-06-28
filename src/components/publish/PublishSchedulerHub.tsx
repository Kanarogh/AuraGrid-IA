"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CloudOff, Grid3X3, Loader2 } from "lucide-react";
import type { CanvaGridPage, PlannedPost } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { usePublishQueuePoll } from "../../hooks/usePublishQueuePoll";
import { toast } from "../../lib/toast";
import { Button } from "../ui/Button";
import { PublishHubStatusStrip } from "./PublishHubStatusStrip";
import { PublishPrefsPanel } from "./PublishPrefsPanel";
import { PublishPreviewModal } from "./PublishPreviewModal";
import { PublishCalendar } from "./PublishCalendar";
import { PublishCalendarToolbar, PublishStatusBanner } from "./PublishCalendarToolbar";
import { UnscheduledTray } from "./UnscheduledTray";
import { PublishListView } from "./PublishListView";
import { PublishComposerDrawer } from "./PublishComposerDrawer";
import { PublishFeedPreviewPanel } from "./PublishFeedPreviewPanel";
import {
  createPublishJobs,
  fetchMetaConnection,
  fetchPublishPrefs,
  fetchPublishQueue,
  patchPublishJob,
  previewPublishSchedule,
  type MetaConnectionPublic,
  type PublishPrefs,
  type PublishQueueItem,
  type PublishQueueSummary,
} from "../../lib/publish/publishApi";
import {
  clearPublishDrafts,
  loadPublishDrafts,
  savePublishDrafts,
} from "../../lib/publish/publishDraftStorage";
import { filterQueue, filterTrayItems, queueMetrics } from "./publishUiUtils";
import { calendarDateForPost } from "../../lib/publish/suggestScheduleTimes";
import {
  combineDateAndTime,
  filterEligibleInVisibleRange,
  findScheduleConflicts,
  formatScheduleToast,
  getVisibleDateKeys,
  resolvePublishCaption,
  validateScheduledTime,
  wouldCreateConflict,
  type CalendarViewMode,
  type HubViewMode,
} from "./publishCalendarUtils";

const CHECKLIST_KEY = "ag_publish_checklist_done";
const FEED_PREVIEW_KEY = "ag_publish_show_feed_preview";

function readFeedPreviewPref(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(FEED_PREVIEW_KEY) !== "0";
}

function loadErrorDetail(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message.trim() : String(err).trim();
  return msg || fallback;
}

export function PublishSchedulerHub({
  clientId,
  planningPeriodId,
  startDate,
  instagramHandle,
  displayName,
  posts,
  canvaPages,
  canvaGridReversed,
  onNavigatePosts,
  metaConnectedParam,
}: {
  clientId: string;
  planningPeriodId: string;
  startDate: string;
  instagramHandle: string;
  displayName: string;
  posts: PlannedPost[];
  canvaPages?: CanvaGridPage[];
  canvaGridReversed?: boolean;
  onNavigatePosts: () => void;
  metaConnectedParam?: boolean;
}) {
  const { storageMode } = useAuth();
  const cloudOnly = storageMode === "postgresql";

  const [hubView, setHubView] = useState<HubViewMode>("calendar");
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [queue, setQueue] = useState<PublishQueueItem[]>([]);
  const [summary, setSummary] = useState<PublishQueueSummary | null>(null);
  const [connection, setConnection] = useState<MetaConnectionPublic | null>(null);
  const [prefs, setPrefs] = useState<PublishPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftSchedules, setDraftSchedulesState] = useState<Record<string, string>>(() =>
    loadPublishDrafts(clientId, planningPeriodId)
  );
  const [composerItem, setComposerItem] = useState<PublishQueueItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false);
  const [pendingConfirmIds, setPendingConfirmIds] = useState<string[]>([]);
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [showFeedPreview, setShowFeedPreview] = useState(readFeedPreviewPref);

  const toggleFeedPreview = useCallback(() => {
    setShowFeedPreview((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(FEED_PREVIEW_KEY, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  const setDraftSchedules = useCallback(
    (updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
      setDraftSchedulesState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        savePublishDrafts(clientId, planningPeriodId, next);
        return next;
      });
    },
    [clientId, planningPeriodId]
  );

  useEffect(() => {
    setDraftSchedulesState(loadPublishDrafts(clientId, planningPeriodId));
  }, [clientId, planningPeriodId]);

  useEffect(() => {
    void fetchPublishPrefs(clientId).then(setPrefs);
  }, [clientId]);

  const refresh = useCallback(async (silent = false) => {
    if (!cloudOnly) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const [queueResult, metaResult] = await Promise.allSettled([
        fetchPublishQueue(clientId, planningPeriodId),
        fetchMetaConnection(clientId),
      ]);

      if (queueResult.status === "fulfilled") {
        setQueue(queueResult.value.queue);
        setSummary(queueResult.value.summary);
      } else if (!silent) {
        toast.error(
          `Não foi possível carregar a fila: ${loadErrorDetail(queueResult.reason, "erro desconhecido.")}`
        );
      }

      if (metaResult.status === "fulfilled") {
        setConnection(metaResult.value);
      } else if (!silent && queueResult.status === "fulfilled") {
        toast.warning(
          `Conexão Meta indisponível: ${loadErrorDetail(metaResult.reason, "tente recarregar a página.")}`
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [clientId, planningPeriodId, cloudOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePublishQueuePoll(() => refresh(true), cloudOnly && hubView !== "settings", 30000);

  useEffect(() => {
    if (metaConnectedParam) {
      toast.success("Conta Instagram conectada!");
      void refresh();
    }
  }, [metaConnectedParam, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(CHECKLIST_KEY) && cloudOnly) setShowChecklist(true);
  }, [cloudOnly]);

  const shiftAnchor = useCallback((delta: -1 | 1) => {
    setAnchorDate((d) => {
      const next = new Date(d);
      if (calendarMode === "week") next.setDate(next.getDate() + delta * 7);
      else next.setMonth(next.getMonth() + delta);
      return next;
    });
  }, [calendarMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hubView !== "calendar") return;
      if (e.key === "ArrowLeft") shiftAnchor(-1);
      if (e.key === "ArrowRight") shiftAnchor(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hubView, shiftAnchor]);

  const metrics = useMemo(() => queueMetrics(queue), [queue]);
  const connected = Boolean(
    connection?.connected && connection.status === "active" && !connection.needsReconnect
  );
  const publishMockEnabled = summary?.publishMockEnabled ?? prefs?.publishMockEnabled ?? false;
  const canSchedule = connected || publishMockEnabled;
  const scheduleTimezone = prefs?.timezone ?? "America/Sao_Paulo";
  const leadMinutes = prefs?.defaultLeadMinutes ?? 15;
  const autoScheduleOnDrop = prefs?.autoScheduleOnDrop ?? false;
  const eligible = useMemo(() => filterQueue(queue, "eligible"), [queue]);
  const trayItems = useMemo(() => filterTrayItems(eligible, draftSchedules), [eligible, draftSchedules]);
  const draftCount = Object.keys(draftSchedules).length;

  const scheduleOneJob = useCallback(
    async (item: PublishQueueItem, scheduledIso: string) => {
      await createPublishJobs(clientId, planningPeriodId, [
        {
          plannedPostId: item.plannedPostId,
          scheduledAt: scheduledIso,
          caption: resolvePublishCaption(item, posts),
          imageAssetId: item.imageAssetId!,
        },
      ]);
      setDraftSchedules((prev) => {
        const next = { ...prev };
        delete next[item.plannedPostId];
        return next;
      });
    },
    [clientId, planningPeriodId, posts, setDraftSchedules]
  );

  const conflicts = useMemo(
    () => findScheduleConflicts([...queue, ...eligible], draftSchedules),
    [queue, eligible, draftSchedules]
  );

  const handleDrop = async (_dateKey: string, postId: string, scheduledIso: string) => {
    const item = queue.find((q) => q.plannedPostId === postId);
    if (!item) return;

    const validation = validateScheduledTime(scheduledIso, leadMinutes);
    if (!validation.ok) {
      toast.warning(validation.reason);
      return;
    }

    if (wouldCreateConflict(scheduledIso, postId, [...queue, ...eligible], draftSchedules)) {
      toast.warning("Já existe outro post neste horário. Escolha outro minuto.");
      return;
    }

    if (item.status === "queued" || item.status === "publishing") {
      if (!item.jobId) return;
      try {
        await patchPublishJob(clientId, item.jobId, { scheduledAt: scheduledIso });
        toast.success(`Reagendado para ${formatScheduleToast(scheduledIso)}`);
        await refresh(true);
      } catch {
        toast.error("Não foi possível reagendar.");
      }
      return;
    }

    if (item.status !== "eligible") {
      toast.warning("Este post ainda não está pronto para agendar.");
      return;
    }

    if (autoScheduleOnDrop) {
      if (!canSchedule) {
        toast.warning("Conecte o Instagram ou ative o modo simulação para agendar.");
        return;
      }
      try {
        await scheduleOneJob(item, scheduledIso);
        toast.success(`Post agendado para ${formatScheduleToast(scheduledIso)}`);
        await refresh(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao agendar.");
      }
      return;
    }

    setDraftSchedules((d) => ({ ...d, [postId]: scheduledIso }));
    toast.success(
      `Rascunho: ${formatScheduleToast(scheduledIso)} — confirme quando estiver pronto.`
    );
  };

  const handleSuggestVisible = async () => {
    setSuggesting(true);
    try {
      const visible = getVisibleDateKeys(anchorDate, calendarMode);
      const inRange = filterEligibleInVisibleRange(eligible, startDate, visible);
      if (!inRange.length) {
        toast.warning("Nenhum post pronto neste período do calendário.");
        return;
      }
      const postIds = inRange.map((e) => e.plannedPostId);
      const suggestions = await previewPublishSchedule(clientId, planningPeriodId, postIds);
      const next: Record<string, string> = { ...draftSchedules };
      for (const s of suggestions) {
        next[s.postId] = s.scheduledAt;
      }
      setDraftSchedules(next);
      setPendingConfirmIds(suggestions.map((s) => s.postId));
      toast.success(`${suggestions.length} horários sugeridos neste período.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao sugerir horários.");
    } finally {
      setSuggesting(false);
    }
  };

  const handleExpandDay = (dateKey: string) => {
    if (calendarMode === "month") {
      if (expandedDayKey === dateKey) {
        setExpandedDayKey(null);
        return;
      }
      setExpandedDayKey(dateKey);
      return;
    }
    setExpandedDayKey(expandedDayKey === dateKey ? null : dateKey);
  };

  const confirmTargets = useMemo(() => {
    const ids = pendingConfirmIds.length
      ? pendingConfirmIds
      : eligible.map((e) => e.plannedPostId);
    return eligible.filter((e) => ids.includes(e.plannedPostId) && draftSchedules[e.plannedPostId]);
  }, [pendingConfirmIds, eligible, draftSchedules]);

  const executeBulkSchedule = async () => {
    if (!canSchedule) {
      toast.warning("Conecte o Instagram ou use o modo simulação para confirmar.");
      return;
    }
    if (conflicts.size > 0) {
      toast.warning("Resolva os conflitos de horário antes de confirmar.");
      return;
    }
    if (!confirmTargets.length) {
      toast.warning("Nenhum post com horário definido.");
      return;
    }
    setConfirming(true);
    try {
      await createPublishJobs(
        clientId,
        planningPeriodId,
        confirmTargets.map((t) => ({
          plannedPostId: t.plannedPostId,
          scheduledAt: draftSchedules[t.plannedPostId]!,
          caption: resolvePublishCaption(t, posts),
          imageAssetId: t.imageAssetId!,
        }))
      );
      toast.success(`${confirmTargets.length} posts agendados!`);
      setPreviewOpen(false);
      setDraftSchedules({});
      clearPublishDrafts(clientId, planningPeriodId);
      setPendingConfirmIds([]);
      localStorage.setItem(CHECKLIST_KEY, "1");
      setShowChecklist(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao programar.");
    } finally {
      setConfirming(false);
    }
  };

  if (!cloudOnly) {
    return (
      <div className="ag-workspace-section max-w-lg mx-auto text-center py-16 space-y-4">
        <CloudOff className="h-12 w-12 mx-auto text-ag-muted" />
        <h2 className="font-display text-xl font-semibold text-ag-text">Modo nuvem necessário</h2>
        <p className="text-sm text-ag-muted">
          Programar posts no Instagram requer conta na nuvem com banco de dados e mídia armazenada.
        </p>
      </div>
    );
  }

  return (
    <div className="ag-workspace-section space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ag-text flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-ag-accent" />
            Programar posts
          </h1>
          <p className="text-sm text-ag-muted mt-1">
            Calendário de publicação · arraste posts prontos para agendar
          </p>
        </div>
        {connection?.igUsername && (
          <p className="text-xs text-ag-muted">@{connection.igUsername}</p>
        )}
      </div>

      <PublishStatusBanner
        connected={connected}
        eligible={metrics.eligible}
        showChecklist={showChecklist}
        onDismissChecklist={() => {
          setShowChecklist(false);
          localStorage.setItem(CHECKLIST_KEY, "1");
        }}
      />

      <PublishCalendarToolbar
        anchorDate={anchorDate}
        calendarMode={calendarMode}
        hubView={hubView}
        summary={summary}
        onAnchorChange={shiftAnchor}
        onCalendarModeChange={(mode) => {
          setCalendarMode(mode);
          setExpandedDayKey(null);
        }}
        onHubViewChange={setHubView}
        onToday={() => setAnchorDate(new Date())}
        showFeedPreview={showFeedPreview}
        onToggleFeedPreview={hubView === "calendar" ? toggleFeedPreview : undefined}
      />

      {hubView === "calendar" && (
        <PublishHubStatusStrip
          clientId={clientId}
          connected={connected}
          publishMockEnabled={publishMockEnabled}
          canSchedule={canSchedule}
          draftCount={autoScheduleOnDrop ? 0 : draftCount}
          conflictCount={conflicts.size}
          confirmDisabled={conflicts.size > 0 || confirmTargets.length === 0}
          onConfirmDrafts={() => setPreviewOpen(true)}
          onOpenSettings={() => setHubView("settings")}
        />
      )}

      {loading && hubView !== "settings" ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-ag-accent" />
        </div>
      ) : hubView === "settings" ? (
        <PublishPrefsPanel
          clientId={clientId}
          connection={connection}
          publishMockEnabled={publishMockEnabled}
          onConnectionRefresh={() => void refresh()}
          onPrefsChange={setPrefs}
        />
      ) : hubView === "list" ? (
        <PublishListView
          clientId={clientId}
          queue={queue}
          draftSchedules={draftSchedules}
          onDraftSchedule={(id, iso) => setDraftSchedules((d) => ({ ...d, [id]: iso }))}
          onRefresh={() => void refresh()}
          onItemClick={setComposerItem}
        />
      ) : (
        <div
          className={
            showFeedPreview
              ? "grid gap-4 xl:grid-cols-[1fr_minmax(280px,340px)]"
              : "grid gap-4 grid-cols-1"
          }
        >
          <div className="space-y-4 min-w-0">
            <PublishCalendar
              queue={queue}
              draftSchedules={draftSchedules}
              anchorDate={anchorDate}
              calendarMode={calendarMode}
              startDate={startDate}
              expandedDayKey={expandedDayKey}
              scheduleTimezone={scheduleTimezone}
              onExpandDay={handleExpandDay}
              onDrop={(dk, pid, iso) => void handleDrop(dk, pid, iso)}
              onItemClick={setComposerItem}
              onEmptyDayClick={(dateKey) => {
                const match =
                  trayItems.find(
                    (e) => calendarDateForPost(startDate, e.dayNumber) === dateKey
                  ) ?? trayItems[0];
                if (!match) return;
                void handleDrop(dateKey, match.plannedPostId, combineDateAndTime(dateKey, "10:00", scheduleTimezone));
              }}
            />

            <UnscheduledTray
              items={trayItems}
              draftSchedules={draftSchedules}
              onItemClick={setComposerItem}
              onSuggestAll={() => void handleSuggestVisible()}
              suggesting={suggesting}
            />

            {trayItems.length === 0 && eligible.length === 0 && metrics.scheduled === 0 && (
              <div className="rounded-2xl border border-dashed border-ag-border p-6 text-center space-y-3">
                <p className="text-sm text-ag-muted">Nenhum post aprovado com foto e legenda.</p>
                <Button type="button" variant="accent" onClick={onNavigatePosts}>
                  Ir para Planejamento e legendas
                </Button>
              </div>
            )}
          </div>

          {showFeedPreview && (
            <div className="hidden xl:block min-h-0">
              <PublishFeedPreviewPanel
                posts={posts}
                queue={queue}
                draftSchedules={draftSchedules}
                canvaPages={canvaPages}
                canvaGridReversed={canvaGridReversed}
                displayName={displayName}
                instagramHandle={instagramHandle}
                onHide={toggleFeedPreview}
              />
            </div>
          )}
        </div>
      )}

      {showFeedPreview && (
        <div className="fixed bottom-4 right-4 xl:hidden z-30">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="shadow-lg rounded-full h-12 w-12 p-0"
            onClick={() => setMobileFeedOpen(true)}
            aria-label="Preview do feed"
          >
            <Grid3X3 className="h-5 w-5" />
          </Button>
        </div>
      )}

      {mobileFeedOpen && showFeedPreview && (
        <div className="fixed inset-x-0 bottom-0 z-40 xl:hidden p-4 pb-6 bg-ag-surface-1 border-t border-ag-border shadow-2xl max-h-[70vh] overflow-auto">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold">Preview do feed</p>
            <button type="button" className="text-ag-muted text-sm" onClick={() => setMobileFeedOpen(false)}>
              Fechar
            </button>
          </div>
          <PublishFeedPreviewPanel
            posts={posts}
            queue={queue}
            draftSchedules={draftSchedules}
            canvaPages={canvaPages}
            canvaGridReversed={canvaGridReversed}
            displayName={displayName}
            instagramHandle={instagramHandle}
            mobileSheet
            onHide={() => {
              setMobileFeedOpen(false);
              toggleFeedPreview();
            }}
          />
        </div>
      )}

      <PublishComposerDrawer
        open={!!composerItem}
        item={composerItem}
        clientId={clientId}
        planningPeriodId={planningPeriodId}
        draftSchedules={draftSchedules}
        posts={posts}
        instagramHandle={instagramHandle}
        canSchedule={canSchedule}
        scheduleTimezone={scheduleTimezone}
        leadMinutes={leadMinutes}
        onClose={() => setComposerItem(null)}
        onDraftSchedule={(id, iso) => setDraftSchedules((d) => ({ ...d, [id]: iso }))}
        onClearDraft={(id) =>
          setDraftSchedules((d) => {
            const next = { ...d };
            delete next[id];
            return next;
          })
        }
        onScheduleJob={scheduleOneJob}
        onRefresh={() => void refresh()}
        onNavigatePosts={onNavigatePosts}
      />

      <PublishPreviewModal
        open={previewOpen}
        items={confirmTargets.length ? confirmTargets : eligible}
        draftSchedules={draftSchedules}
        instagramHandle={instagramHandle}
        onClose={() => setPreviewOpen(false)}
        onConfirm={() => void executeBulkSchedule()}
        confirming={confirming}
      />
    </div>
  );
}
