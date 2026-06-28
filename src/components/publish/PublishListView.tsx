"use client";

import { useMemo, useState } from "react";
import { cn } from "../../lib/cn";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import { PublishQueuePanel } from "./PublishQueuePanel";
import { filterQueue, queueMetrics, type PublishFilter } from "./publishUiUtils";
import { patchPublishJob } from "../../lib/publish/publishApi";
import { toast } from "../../lib/toast";
import { Button } from "../ui/Button";
import { RefreshCw, XCircle } from "lucide-react";

export function PublishListView({
  clientId,
  queue,
  draftSchedules,
  onDraftSchedule,
  onRefresh,
  onItemClick,
  onNavigateToPost,
}: {
  clientId: string;
  queue: PublishQueueItem[];
  draftSchedules: Record<string, string>;
  onDraftSchedule: (postId: string, iso: string) => void;
  onRefresh: () => void;
  onItemClick?: (item: PublishQueueItem) => void;
  onNavigateToPost?: (plannedPostId: string) => void;
}) {
  const [filter, setFilter] = useState<PublishFilter>("all");
  const metrics = useMemo(() => queueMetrics(queue), [queue]);
  const failedItems = useMemo(() => filterQueue(queue, "failed"), [queue]);
  const queuedItems = useMemo(() => filterQueue(queue, "queued"), [queue]);

  const filters: { id: PublishFilter; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: queue.length },
    { id: "eligible", label: "Prontos", count: metrics.eligible },
    { id: "not_ready", label: "Incompletos", count: metrics.notReady },
    { id: "queued", label: "Agendados", count: metrics.scheduled },
    { id: "published", label: "Publicados", count: metrics.published },
    { id: "failed", label: "Com problema", count: metrics.failed },
  ];

  const handleBulkCancel = async () => {
    let ok = 0;
    for (const item of queuedItems) {
      if (!item.jobId) continue;
      try {
        await patchPublishJob(clientId, item.jobId, { status: "cancelled" });
        ok++;
      } catch {
        /* skip */
      }
    }
    if (ok) toast.success(`${ok} agendamentos cancelados.`);
    onRefresh();
  };

  const handleBulkRetry = async () => {
    const { retryPublishJob } = await import("../../lib/publish/publishApi");
    let ok = 0;
    for (const item of failedItems) {
      if (!item.jobId) continue;
      try {
        await retryPublishJob(clientId, item.jobId);
        ok++;
      } catch {
        /* skip */
      }
    }
    if (ok) toast.success(`${ok} posts reenviados.`);
    onRefresh();
  };

  const handleDraftScheduleWithPersist = async (postId: string, iso: string) => {
    onDraftSchedule(postId, iso);
    const item = queue.find((q) => q.plannedPostId === postId);
    if (item?.jobId && (item.status === "queued" || item.status === "failed")) {
      try {
        await patchPublishJob(clientId, item.jobId, { scheduledAt: iso });
        toast.success("Horário atualizado.");
        onRefresh();
      } catch {
        toast.error("Não foi possível reagendar.");
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              filter === f.id
                ? "border-ag-accent bg-ag-accent-soft text-ag-accent"
                : "border-ag-border text-ag-muted hover:border-ag-accent/40"
            )}
          >
            {f.label} ({f.count})
          </button>
        ))}
        {queuedItems.length > 1 && filter === "queued" && (
          <Button type="button" variant="ghost" size="sm" onClick={() => void handleBulkCancel()}>
            <XCircle className="h-3.5 w-3.5" />
            Cancelar todos agendados
          </Button>
        )}
        {failedItems.length > 1 && (
          <Button type="button" variant="secondary" size="sm" onClick={() => void handleBulkRetry()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar todos com problema
          </Button>
        )}
      </div>
      <PublishQueuePanel
        clientId={clientId}
        queue={queue}
        filter={filter}
        draftSchedules={draftSchedules}
        onDraftSchedule={handleDraftScheduleWithPersist}
        onRefresh={onRefresh}
        selectedIds={new Set()}
        onToggleSelect={() => {}}
        onSelectDay={() => {}}
        onItemClick={onItemClick}
        onNavigateToPost={onNavigateToPost}
      />
    </div>
  );
}
