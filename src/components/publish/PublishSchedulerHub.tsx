"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CloudOff, Grid3X3, Loader2 } from "lucide-react";
import type { CanvaGridPage, PlannedPost } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { usePublishQueuePoll } from "../../hooks/usePublishQueuePoll";
import { toast } from "../../lib/toast";
import { Button } from "../ui/Button";
import { MetaConnectionCard } from "./MetaConnectionCard";
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
  fetchPublishQueue,
  patchPublishJob,
  previewPublishSchedule,
  type MetaConnectionPublic,
  type PublishQueueItem,
  type PublishQueueSummary,
} from "../../lib/publish/publishApi";
import { filterQueue, queueMetrics } from "./publishUiUtils";
import { calendarDateForPost } from "../../lib/publish/suggestScheduleTimes";
import {
  combineDateAndTime,
  filterEligibleInVisibleRange,
  findScheduleConflicts,
  getVisibleDateKeys,
  type CalendarViewMode,
  type HubViewMode,
} from "./publishCalendarUtils";

const CHECKLIST_KEY = "ag_publish_checklist_done";

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
  const [loading, setLoading] = useState(true);
  const [draftSchedules, setDraftSchedules] = useState<Record<string, string>>({});
  const [composerItem, setComposerItem] = useState<PublishQueueItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false);
  const [pendingConfirmIds, setPendingConfirmIds] = useState<string[]>([]);
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

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
  const eligible = useMemo(() => filterQueue(queue, "eligible"), [queue]);

  const conflicts = useMemo(
    () => findScheduleConflicts([...queue, ...eligible], draftSchedules),
    [queue, eligible, draftSchedules]
  );

  const handleDrop = async (_dateKey: string, postId: string, scheduledIso: string) => {
    const item = queue.find((q) => q.plannedPostId === postId);
    if (!item) return;

    setDraftSchedules((d) => ({ ...d, [postId]: scheduledIso }));

    if (item.status === "queued" || item.status === "publishing") {
      if (!item.jobId) return;
      try {
        await patchPublishJob(clientId, item.jobId, { scheduledAt: scheduledIso });
        toast.success(
          `Reagendado para ${new Date(scheduledIso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
        );
        await refresh(true);
      } catch {
        toast.error("Não foi possível reagendar.");
      }
    } else {
      setComposerItem({ ...item });
      toast.success("Horário definido — confirme no painel.");
    }
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
          caption: t.caption,
          imageAssetId: t.imageAssetId!,
        }))
      );
      toast.success(`${confirmTargets.length} posts agendados!`);
      setPreviewOpen(false);
      setDraftSchedules({});
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
      />

      {!connected && (
        <MetaConnectionCard
          clientId={clientId}
          connection={connection}
          onRefresh={() => void refresh()}
          compact
        />
      )}

      {conflicts.size > 0 && hubView === "calendar" && (
        <p className="text-xs text-ag-warning rounded-lg border border-ag-warning/30 bg-ag-warning/5 px-3 py-2">
          {conflicts.size} conflito(s) de horário — dois posts no mesmo minuto. Ajuste antes de confirmar.
        </p>
      )}

      {loading && hubView !== "settings" ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-ag-accent" />
        </div>
      ) : hubView === "settings" ? (
        <PublishPrefsPanel
          clientId={clientId}
          connection={connection}
          onConnectionRefresh={() => void refresh()}
          hideConnection={!connected}
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
        <div className="grid gap-4 xl:grid-cols-[1fr_minmax(280px,340px)]">
          <div className="space-y-4 min-w-0">
            <UnscheduledTray
              items={eligible}
              draftSchedules={draftSchedules}
              onItemClick={setComposerItem}
              onSuggestAll={() => void handleSuggestVisible()}
              suggesting={suggesting}
            />

            {eligible.length === 0 && metrics.scheduled === 0 && (
              <div className="rounded-2xl border border-dashed border-ag-border p-8 text-center space-y-3">
                <p className="text-sm text-ag-muted">Nenhum post aprovado com foto e legenda.</p>
                <Button type="button" variant="accent" onClick={onNavigatePosts}>
                  Ir para Planejamento e legendas
                </Button>
              </div>
            )}

            <PublishCalendar
              queue={queue}
              draftSchedules={draftSchedules}
              anchorDate={anchorDate}
              calendarMode={calendarMode}
              startDate={startDate}
              expandedDayKey={expandedDayKey}
              onExpandDay={handleExpandDay}
              onDrop={(dk, pid, iso) => void handleDrop(dk, pid, iso)}
              onItemClick={setComposerItem}
              onEmptyDayClick={(dateKey) => {
                const match =
                  eligible.find(
                    (e) => calendarDateForPost(startDate, e.dayNumber) === dateKey
                  ) ?? eligible[0];
                if (!match) return;
                const iso = combineDateAndTime(dateKey, "10:00");
                setDraftSchedules((d) => ({ ...d, [match.plannedPostId]: iso }));
                setComposerItem(match);
              }}
            />

            {Object.keys(draftSchedules).length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end">
                <Button type="button" variant="accent" disabled={!connected} onClick={() => setPreviewOpen(true)}>
                  Confirmar {confirmTargets.length || Object.keys(draftSchedules).length} posts
                </Button>
              </div>
            )}
          </div>

          <div className="hidden xl:block">
            <PublishFeedPreviewPanel
              posts={posts}
              queue={queue}
              draftSchedules={draftSchedules}
              canvaPages={canvaPages}
              canvaGridReversed={canvaGridReversed}
              displayName={displayName}
              instagramHandle={instagramHandle}
            />
          </div>
        </div>
      )}

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

      {mobileFeedOpen && (
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
        connected={connected}
        onClose={() => setComposerItem(null)}
        onDraftSchedule={(id, iso) => setDraftSchedules((d) => ({ ...d, [id]: iso }))}
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
