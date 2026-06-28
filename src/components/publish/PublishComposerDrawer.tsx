"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Eye, EyeOff, RefreshCw, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { InstagramPhonePreview } from "../posts/InstagramPhonePreview";
import {
  createPublishJobs,
  patchPublishJob,
  retryPublishJob,
  type PublishQueueItem,
} from "../../lib/publish/publishApi";
import {
  localInputToIso,
  scheduledAtToLocalInput,
} from "./publishUiUtils";
import { queueItemToPlannedPost, resolveItemSchedule } from "./publishCalendarUtils";
import { toast } from "../../lib/toast";

export function PublishComposerDrawer({
  open,
  item,
  clientId,
  planningPeriodId,
  draftSchedules,
  instagramHandle,
  connected,
  onClose,
  onDraftSchedule,
  onRefresh,
  onNavigatePosts,
}: {
  open: boolean;
  item: PublishQueueItem | null;
  clientId: string;
  planningPeriodId: string;
  draftSchedules: Record<string, string>;
  instagramHandle: string;
  connected: boolean;
  onClose: () => void;
  onDraftSchedule: (postId: string, iso: string) => void;
  onRefresh: () => void;
  onNavigatePosts: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !item) return null;

  const iso = resolveItemSchedule(item, draftSchedules) ?? "";
  const local = scheduledAtToLocalInput(iso || null);
  const isEligible = item.status === "eligible";
  const isQueued = item.status === "queued" || item.status === "publishing";
  const isFailed = item.status === "failed";
  const mockPost = queueItemToPlannedPost(item);

  const updateSchedule = (date: string, time: string) => {
    onDraftSchedule(item.plannedPostId, localInputToIso(date, time));
  };

  const handleSchedule = async () => {
    if (!iso) {
      toast.warning("Escolha data e hora.");
      return;
    }
    if (!connected) {
      toast.warning("Conecte o Instagram antes de agendar.");
      return;
    }
    setSaving(true);
    try {
      if (isEligible) {
        await createPublishJobs(clientId, planningPeriodId, [
          {
            plannedPostId: item.plannedPostId,
            scheduledAt: iso,
            caption: item.caption,
            imageAssetId: item.imageAssetId!,
          },
        ]);
        toast.success("Post agendado!");
      } else if (isQueued && item.jobId) {
        await patchPublishJob(clientId, item.jobId, { scheduledAt: iso });
        toast.success("Horário atualizado.");
      }
      onClose();
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!item.jobId) return;
    setSaving(true);
    try {
      await patchPublishJob(clientId, item.jobId, { status: "cancelled" });
      toast.success("Agendamento cancelado.");
      onClose();
      await onRefresh();
    } catch {
      toast.error("Não foi possível cancelar.");
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = async () => {
    if (!item.jobId) return;
    setSaving(true);
    try {
      await retryPublishJob(clientId, item.jobId);
      toast.success("Tentando publicar novamente.");
      onClose();
      await onRefresh();
    } catch {
      toast.error("Não foi possível tentar de novo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onClose} aria-hidden />
      <aside
        className={cn(
          "fixed z-50 top-0 right-0 h-full w-full max-w-md",
          "border-l border-ag-border bg-ag-surface-1 shadow-2xl",
          "flex flex-col animate-ag-fade-in"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do post"
      >
        <div className="flex items-center justify-between p-4 border-b border-ag-border">
          <div>
            <h2 className="font-display text-lg font-semibold text-ag-text">
              Dia {item.dayNumber}
            </h2>
            <p className="text-xs text-ag-muted">{item.dateLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ag-surface-2 text-ag-muted ag-focus-ring"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-ag-border bg-ag-surface-2 px-3 py-2 text-sm text-ag-text hover:bg-ag-surface-3 ag-focus-ring"
          >
            <span className="font-medium">Preview Instagram</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-ag-muted">
              {showPreview ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Ocultar
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Mostrar
                </>
              )}
            </span>
          </button>

          {showPreview && (
            <div className="flex justify-center scale-90 origin-top">
              <InstagramPhonePreview post={mockPost} username={instagramHandle} variant="compact" />
            </div>
          )}

          {(isEligible || isQueued || isFailed) && (
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={local.date}
                onChange={(e) => updateSchedule(e.target.value, local.time)}
                className="flex-1 min-w-[120px] rounded-lg border border-ag-border bg-ag-surface-2 px-3 py-2 text-sm ag-focus-ring"
              />
              <input
                type="time"
                value={local.time}
                onChange={(e) => updateSchedule(local.date, e.target.value)}
                className="rounded-lg border border-ag-border bg-ag-surface-2 px-3 py-2 text-sm ag-focus-ring"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted">Legenda</p>
              <button
                type="button"
                className="text-xs text-ag-accent hover:underline"
                onClick={onNavigatePosts}
              >
                Editar em Planejamento
              </button>
            </div>
            <p className="text-sm text-ag-text whitespace-pre-wrap">{item.caption}</p>
          </div>

          {item.status === "published" && item.permalink && (
            <a
              href={item.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ag-accent inline-flex items-center gap-1 hover:underline"
            >
              Ver no Instagram <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {isFailed && item.lastError && (
            <p className="text-sm text-ag-danger rounded-lg border border-ag-danger/30 bg-ag-danger/5 p-3">
              {item.lastError}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-ag-border flex flex-col gap-2">
          {(isEligible || isQueued) && (
            <Button
              type="button"
              variant="accent"
              className="w-full"
              disabled={saving || !connected}
              onClick={() => void handleSchedule()}
            >
              {saving ? "Salvando…" : isEligible ? "Agendar post" : "Salvar horário"}
            </Button>
          )}
          {isFailed && (
            <Button type="button" variant="accent" className="w-full" disabled={saving} onClick={() => void handleRetry()}>
              <RefreshCw className="h-4 w-4" />
              Tentar de novo
            </Button>
          )}
          {(isQueued || isFailed) && item.jobId && (
            <Button type="button" variant="ghost" className="w-full text-ag-danger" disabled={saving} onClick={() => void handleCancel()}>
              Cancelar agendamento
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}
