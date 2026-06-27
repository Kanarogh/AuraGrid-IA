"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PostFeedImage } from "../posts/PostFeedImage";
import {
  PUBLISH_STATUS_LABELS,
  type PublishQueueItem,
} from "../../lib/publish/publishApi";
import {
  filterQueue,
  groupByDay,
  localInputToIso,
  scheduledAtToLocalInput,
  type PublishFilter,
} from "./publishUiUtils";
import { patchPublishJob, retryPublishJob } from "../../lib/publish/publishApi";
import { toast } from "../../lib/toast";

function statusTone(status: PublishQueueItem["status"]) {
  if (status === "published") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "queued" || status === "publishing") return "accent" as const;
  if (status === "cancelled") return "neutral" as const;
  return "neutral" as const;
}

function PublishPostRow({
  item,
  clientId,
  draftSchedule,
  onDraftSchedule,
  onRefresh,
  selected,
  onToggleSelect,
  selectable,
}: {
  item: PublishQueueItem;
  clientId: string;
  draftSchedule?: string;
  onDraftSchedule?: (iso: string) => void;
  onRefresh: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  selectable?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const local = draftSchedule
    ? scheduledAtToLocalInput(draftSchedule)
    : scheduledAtToLocalInput(item.scheduledAt);

  const handleCancel = async () => {
    if (!item.jobId) return;
    try {
      await patchPublishJob(clientId, item.jobId, { status: "cancelled" });
      toast.success("Agendamento cancelado.");
      onRefresh();
    } catch {
      toast.error("Não foi possível cancelar.");
    }
  };

  const handleRetry = async () => {
    if (!item.jobId) return;
    try {
      await retryPublishJob(clientId, item.jobId);
      toast.success("Tentando publicar novamente.");
      onRefresh();
    } catch {
      toast.error("Não foi possível tentar de novo.");
    }
  };

  return (
    <div className="flex gap-3 items-start p-3 rounded-xl border border-ag-border bg-ag-surface-1 hover:border-ag-accent/30 transition-colors">
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-3 h-4 w-4 accent-ag-accent shrink-0"
          aria-label={`Selecionar dia ${item.dayNumber}`}
        />
      )}
      <div className="h-16 w-16 rounded-lg overflow-hidden shrink-0 bg-ag-surface-3 relative">
        {item.imageUrl ? (
          <PostFeedImage src={item.imageUrl} className="absolute inset-0" priority={false} />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-ag-muted text-xs">
            Sem foto
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ag-text">Dia {item.dayNumber}</span>
          <span className="text-xs text-ag-muted">{item.dateLabel}</span>
          <Badge tone={statusTone(item.status)}>{PUBLISH_STATUS_LABELS[item.status]}</Badge>
        </div>
        {(item.status === "eligible" || item.status === "queued" || item.status === "failed") && (
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="date"
              value={local.date}
              onChange={(e) =>
                onDraftSchedule?.(localInputToIso(e.target.value, local.time))
              }
              className="rounded-lg border border-ag-border bg-ag-surface-2 px-2 py-1.5 text-xs ag-focus-ring"
            />
            <input
              type="time"
              value={local.time}
              onChange={(e) =>
                onDraftSchedule?.(localInputToIso(local.date, e.target.value))
              }
              className="rounded-lg border border-ag-border bg-ag-surface-2 px-2 py-1.5 text-xs ag-focus-ring"
            />
          </div>
        )}
        {item.status === "published" && item.permalink && (
          <a
            href={item.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ag-accent inline-flex items-center gap-1 hover:underline"
          >
            Ver no Instagram <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {item.status === "failed" && item.lastError && (
          <p className="text-xs text-ag-danger">{item.lastError}</p>
        )}
      </div>
      <div className="relative shrink-0">
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-ag-surface-2 text-ag-muted ag-focus-ring"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Ações"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-10 min-w-[140px] rounded-xl border border-ag-border bg-ag-surface-1 shadow-lg py-1">
            {item.status === "failed" && (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs hover:bg-ag-surface-2 flex items-center gap-2"
                onClick={() => {
                  setMenuOpen(false);
                  void handleRetry();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tentar de novo
              </button>
            )}
            {(item.status === "queued" || item.status === "failed") && item.jobId && (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs hover:bg-ag-surface-2 flex items-center gap-2 text-ag-danger"
                onClick={() => {
                  setMenuOpen(false);
                  void handleCancel();
                }}
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PublishQueuePanel({
  clientId,
  queue,
  filter,
  draftSchedules,
  onDraftSchedule,
  onRefresh,
  selectedIds,
  onToggleSelect,
  onSelectDay,
}: {
  clientId: string;
  queue: PublishQueueItem[];
  filter: PublishFilter;
  draftSchedules: Record<string, string>;
  onDraftSchedule: (postId: string, iso: string) => void;
  onRefresh: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (postId: string) => void;
  onSelectDay: (postIds: string[]) => void;
}) {
  const filtered = useMemo(() => filterQueue(queue, filter), [queue, filter]);
  const grouped = useMemo(() => groupByDay(filtered), [filtered]);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ag-border p-10 text-center space-y-3">
        <Calendar className="h-10 w-10 mx-auto text-ag-muted/50" />
        <p className="text-sm text-ag-muted">Nenhum post nesta categoria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {[...grouped.entries()]
        .sort(([a], [b]) => a - b)
        .map(([day, items]) => {
          const isOpen = !collapsed[day];
          return (
            <div key={day} className="rounded-2xl border border-ag-border overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-ag-surface-2/80 hover:bg-ag-surface-2 text-left"
                onClick={() => setCollapsed((c) => ({ ...c, [day]: !c[day] }))}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-ag-text">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-ag-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-ag-muted" />
                  )}
                  Dia {day} · {items[0]?.dateLabel} · {items.length}{" "}
                  {items.length === 1 ? "post" : "posts"}
                </span>
                {filter === "eligible" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDay(items.map((i) => i.plannedPostId));
                    }}
                  >
                    Selecionar dia
                  </Button>
                )}
              </button>
              {isOpen && (
                <div className="p-3 space-y-2 bg-ag-surface-1/50">
                  {items.map((item) => (
                    <PublishPostRow
                      key={item.plannedPostId}
                      item={item}
                      clientId={clientId}
                      draftSchedule={draftSchedules[item.plannedPostId]}
                      onDraftSchedule={(iso) => onDraftSchedule(item.plannedPostId, iso)}
                      onRefresh={onRefresh}
                      selectable={filter === "eligible"}
                      selected={selectedIds.has(item.plannedPostId)}
                      onToggleSelect={() => onToggleSelect(item.plannedPostId)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
