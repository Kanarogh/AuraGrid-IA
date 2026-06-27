"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CloudOff, Loader2, Settings2, Sparkles, ListOrdered } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/cn";
import { toast } from "../../lib/toast";
import { WorkflowStepper, type WorkflowStep } from "../layout/WorkflowStepper";
import { TabNav } from "../ui/Tabs";
import { Button } from "../ui/Button";
import { MetaConnectionCard } from "./MetaConnectionCard";
import { PublishPrefsPanel } from "./PublishPrefsPanel";
import { PublishQueuePanel } from "./PublishQueuePanel";
import { PublishPreviewModal } from "./PublishPreviewModal";
import {
  createPublishJobs,
  fetchMetaConnection,
  fetchPublishQueue,
  previewPublishSchedule,
  type MetaConnectionPublic,
  type PublishQueueItem,
} from "../../lib/publish/publishApi";
import { filterQueue, queueMetrics, type PublishFilter } from "./publishUiUtils";

const WIZARD_KEY = "ag_publish_wizard_done";

type Tab = "queue" | "settings";

export function PostSchedulingWorkspace({
  clientId,
  planningPeriodId,
  instagramHandle,
  onNavigatePosts,
  metaConnectedParam,
}: {
  clientId: string;
  planningPeriodId: string;
  instagramHandle: string;
  onNavigatePosts: () => void;
  metaConnectedParam?: boolean;
}) {
  const { storageMode } = useAuth();
  const cloudOnly = storageMode === "postgresql";

  const [tab, setTab] = useState<Tab>("queue");
  const [filter, setFilter] = useState<PublishFilter>("eligible");
  const [queue, setQueue] = useState<PublishQueueItem[]>([]);
  const [connection, setConnection] = useState<MetaConnectionPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftSchedules, setDraftSchedules] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const refresh = useCallback(async () => {
    if (!cloudOnly) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [q, c] = await Promise.all([
        fetchPublishQueue(clientId, planningPeriodId),
        fetchMetaConnection(clientId),
      ]);
      setQueue(q);
      setConnection(c);
    } catch {
      toast.error("Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
    }
  }, [clientId, planningPeriodId, cloudOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (metaConnectedParam) {
      toast.success("Conta Instagram conectada!");
      void refresh();
    }
  }, [metaConnectedParam, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(WIZARD_KEY) && cloudOnly) setShowWizard(true);
  }, [cloudOnly]);

  const metrics = useMemo(() => queueMetrics(queue), [queue]);
  const connected = Boolean(
    connection?.connected && connection.status === "active" && !connection.needsReconnect
  );

  const steps: WorkflowStep[] = useMemo(() => {
    const hasScheduled = metrics.scheduled > 0;
    const hasPublished = metrics.published > 0;
    return [
      { id: "connect", label: "Conectar", done: connected, active: !connected },
      {
        id: "review",
        label: "Revisar",
        done: connected,
        active: connected && metrics.eligible > 0 && !hasScheduled,
      },
      {
        id: "schedule",
        label: "Programar",
        done: hasScheduled || hasPublished,
        active: connected && metrics.eligible > 0 && !hasScheduled,
      },
      {
        id: "track",
        label: "Acompanhar",
        done: hasPublished,
        active: hasScheduled || hasPublished,
      },
    ];
  }, [connected, metrics]);

  const selectedItems = useMemo(() => {
    const eligible = filterQueue(queue, "eligible");
    if (selectedIds.size === 0) return eligible;
    return eligible.filter((q) => selectedIds.has(q.plannedPostId));
  }, [queue, selectedIds]);

  const handleSuggestTimes = async () => {
    try {
      const ids =
        selectedIds.size > 0 ? [...selectedIds] : undefined;
      const suggestions = await previewPublishSchedule(
        clientId,
        planningPeriodId,
        ids
      );
      const next: Record<string, string> = { ...draftSchedules };
      for (const s of suggestions) {
        next[s.postId] = s.scheduledAt;
      }
      setDraftSchedules(next);
      toast.success("Horários sugeridos — revise e confirme.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao sugerir horários.");
    }
  };

  const handleConfirmSchedule = async () => {
    const targets =
      selectedItems.length > 0
        ? selectedItems
        : filterQueue(queue, "eligible");
    if (!targets.length) {
      toast.warning("Nenhum post pronto para programar.");
      return;
    }
    for (const t of targets) {
      if (!draftSchedules[t.plannedPostId]) {
        toast.warning("Clique em «Sugerir horários» antes de confirmar.");
        return;
      }
    }
    setPreviewOpen(true);
  };

  const executeSchedule = async () => {
    const targets =
      selectedItems.length > 0
        ? selectedItems
        : filterQueue(queue, "eligible");
    setConfirming(true);
    try {
      await createPublishJobs(
        clientId,
        planningPeriodId,
        targets.map((t) => ({
          plannedPostId: t.plannedPostId,
          scheduledAt: draftSchedules[t.plannedPostId]!,
          caption: t.caption,
          imageAssetId: t.imageAssetId!,
        }))
      );
      toast.success(
        targets.length === 1
          ? "Post programado!"
          : `${targets.length} posts programados!`
      );
      setPreviewOpen(false);
      setSelectedIds(new Set());
      setDraftSchedules({});
      localStorage.setItem(WIZARD_KEY, "1");
      setShowWizard(false);
      setFilter("queued");
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

  const filterPills: { id: PublishFilter; label: string; count: number }[] = [
    { id: "eligible", label: "Prontos", count: metrics.eligible },
    { id: "queued", label: "Agendados", count: metrics.scheduled },
    { id: "published", label: "Publicados", count: metrics.published },
    { id: "failed", label: "Com problema", count: metrics.failed },
  ];

  return (
    <div className="ag-workspace-section space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ag-text flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-ag-accent" />
            Programar posts
          </h1>
          <p className="text-sm text-ag-muted mt-1">
            Publique no Instagram o que já foi aprovado no planejamento.
          </p>
        </div>
        {connection?.igUsername && (
          <p className="text-xs text-ag-muted">@{connection.igUsername}</p>
        )}
      </div>

      <WorkflowStepper steps={steps} />

      {showWizard && !connected && (
        <div className="rounded-2xl border border-ag-accent/30 bg-ag-accent-soft/30 p-4 space-y-3">
          <p className="text-sm font-medium text-ag-text">Passo 1 de 3 — Conecte sua conta</p>
          <MetaConnectionCard
            clientId={clientId}
            connection={connection}
            onRefresh={() => void refresh()}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowWizard(false)}>
            Já sei, ocultar guia
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(200px,260px)_1fr]">
        <aside className="space-y-2">
          {filterPills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setFilter(pill.id)}
              className={cn(
                "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                filter === pill.id
                  ? "border-ag-accent bg-ag-accent-soft"
                  : "border-ag-border bg-ag-surface-2/50 hover:border-ag-accent/40"
              )}
            >
              <p className="text-2xl font-display font-semibold text-ag-text">{pill.count}</p>
              <p className="text-xs text-ag-muted">{pill.label}</p>
            </button>
          ))}
        </aside>

        <div className="space-y-4 min-w-0">
          <TabNav
            tabs={[
              { id: "queue" as const, label: "Fila", icon: ListOrdered },
              { id: "settings" as const, label: "Configurações", icon: Settings2 },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === "settings" ? (
            <PublishPrefsPanel
              clientId={clientId}
              connection={connection}
              onConnectionRefresh={() => void refresh()}
            />
          ) : (
            <>
              {!connected && (
                <MetaConnectionCard
                  clientId={clientId}
                  connection={connection}
                  onRefresh={() => void refresh()}
                />
              )}

              {filter === "eligible" && metrics.eligible === 0 && (
                <div className="rounded-2xl border border-dashed border-ag-border p-8 text-center space-y-3">
                  <p className="text-sm text-ag-muted">
                    Nenhum post aprovado com foto e legenda prontos.
                  </p>
                  <Button type="button" variant="accent" onClick={onNavigatePosts}>
                    Ir para Planejamento e legendas
                  </Button>
                </div>
              )}

              {filter === "eligible" && metrics.eligible > 0 && (
                <div className="rounded-2xl border border-ag-border bg-ag-surface-2/50 p-4 flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ag-text">
                      {selectedIds.size > 0
                        ? `${selectedIds.size} selecionados`
                        : `${metrics.eligible} posts prontos`}
                    </p>
                    <p className="text-xs text-ag-muted mt-0.5">
                      Sugira horários e confirme para agendar
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="md" onClick={() => void handleSuggestTimes()}>
                      <Sparkles className="h-4 w-4" />
                      Sugerir horários
                    </Button>
                    <Button
                      type="button"
                      variant="accent"
                      size="md"
                      disabled={!connected}
                      onClick={() => void handleConfirmSchedule()}
                    >
                      Confirmar programação
                    </Button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-ag-accent" />
                </div>
              ) : (
                <PublishQueuePanel
                  clientId={clientId}
                  queue={queue}
                  filter={filter}
                  draftSchedules={draftSchedules}
                  onDraftSchedule={(postId, iso) =>
                    setDraftSchedules((d) => ({ ...d, [postId]: iso }))
                  }
                  onRefresh={() => void refresh()}
                  selectedIds={selectedIds}
                  onToggleSelect={(id) =>
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onSelectDay={(ids) => setSelectedIds(new Set(ids))}
                />
              )}
            </>
          )}
        </div>
      </div>

      {filter === "eligible" && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:hidden z-40">
          <Button
            type="button"
            variant="accent"
            size="lg"
            className="w-full shadow-lg"
            disabled={!connected}
            onClick={() => void handleConfirmSchedule()}
          >
            Programar {selectedIds.size} selecionados
          </Button>
        </div>
      )}

      <PublishPreviewModal
        open={previewOpen}
        items={
          selectedItems.length > 0
            ? selectedItems
            : filterQueue(queue, "eligible")
        }
        draftSchedules={draftSchedules}
        instagramHandle={instagramHandle}
        onClose={() => setPreviewOpen(false)}
        onConfirm={() => void executeSchedule()}
        confirming={confirming}
      />
    </div>
  );
}
