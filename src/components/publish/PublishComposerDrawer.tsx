"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, X } from "lucide-react";
import { cn } from "../../lib/cn";
import type { PlannedPost } from "../../types";
import { Button } from "../ui/Button";
import { InstagramPhonePreview } from "../posts/InstagramPhonePreview";
import {
  patchPublishJob,
  retryPublishJob,
  type PublishQueueItem,
} from "../../lib/publish/publishApi";
import {
  localInputToIso,
  scheduledAtToLocalInput,
} from "./publishUiUtils";
import {
  queueItemToPlannedPost,
  resolveItemSchedule,
  resolvePublishCaption,
  validateScheduledTime,
} from "./publishCalendarUtils";
import {
  MSG_CONNECT_SOCIAL_TO_SCHEDULE,
  MSG_SOCIAL_PREVIEW,
  MSG_VIEW_ON_NETWORK,
} from "../../lib/appBranding";
import { toast } from "../../lib/toast";

export function PublishComposerDrawer({
  open,
  item,
  clientId,
  planningPeriodId,
  draftSchedules,
  posts,
  instagramHandle,
  canSchedule,
  scheduleTimezone = "America/Sao_Paulo",
  leadMinutes = 15,
  onClose,
  onDraftSchedule,
  onClearDraft,
  onScheduleJob,
  onRefresh,
  onNavigatePosts,
}: {
  open: boolean;
  item: PublishQueueItem | null;
  clientId: string;
  planningPeriodId: string;
  draftSchedules: Record<string, string>;
  posts: PlannedPost[];
  instagramHandle: string;
  canSchedule: boolean;
  scheduleTimezone?: string;
  leadMinutes?: number;
  onClose: () => void;
  onDraftSchedule: (postId: string, iso: string) => void;
  onClearDraft?: (postId: string) => void;
  onScheduleJob: (item: PublishQueueItem, scheduledIso: string) => Promise<void>;
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

  const caption = useMemo(
    () => (item ? resolvePublishCaption(item, posts) : ""),
    [item, posts]
  );

  const mockPost = useMemo(() => {
    if (!item) return null;
    return { ...queueItemToPlannedPost(item), caption };
  }, [item, caption]);

  if (!open || !item || !mockPost) return null;

  const iso = resolveItemSchedule(item, draftSchedules) ?? "";
  const local = scheduledAtToLocalInput(iso || null);
  const isEligible = item.status === "eligible";
  const isQueued = item.status === "queued" || item.status === "publishing";
  const isFailed = item.status === "failed";
  const hasDraft = Boolean(draftSchedules[item.plannedPostId]);

  const updateSchedule = (date: string, time: string) => {
    onDraftSchedule(item.plannedPostId, localInputToIso(date, time, scheduleTimezone));
  };

  const handleSchedule = async () => {
    if (!iso) {
      toast.warning("Escolha data e hora.");
      return;
    }
    const validation = validateScheduledTime(iso, leadMinutes);
    if (!validation.ok) {
      toast.warning(validation.reason);
      return;
    }
    if (!canSchedule) {
      toast.warning(MSG_CONNECT_SOCIAL_TO_SCHEDULE);
      return;
    }
    setSaving(true);
    try {
      if (isEligible) {
        await onScheduleJob(item, iso);
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

  const handleSaveDraft = () => {
    if (!iso) {
      toast.warning("Escolha data e hora.");
      return;
    }
    const validation = validateScheduledTime(iso, leadMinutes);
    if (!validation.ok) {
      toast.warning(validation.reason);
      return;
    }
    onDraftSchedule(item.plannedPostId, iso);
    toast.success("Rascunho salvo.");
    onClose();
  };

  const handleClearDraft = () => {
    onClearDraft?.(item.plannedPostId);
    toast.info("Rascunho removido.");
    onClose();
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
          "flex flex-col min-h-0 animate-ag-fade-in"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do post"
      >
        <div className="shrink-0 flex items-start justify-between gap-3 p-4 border-b border-ag-border">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ag-text">
              Dia {item.dayNumber}
            </h2>
            <p className="text-xs text-ag-muted">{item.dateLabel}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium ag-focus-ring",
                showPreview
                  ? "border-ag-accent/40 bg-ag-accent/10 text-ag-accent"
                  : "border-ag-border bg-ag-surface-2 text-ag-muted hover:text-ag-text"
              )}
              aria-expanded={showPreview}
            >
              {showPreview ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Ocultar preview
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Ver preview
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-ag-surface-2 text-ag-muted ag-focus-ring"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
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

          <section className="rounded-xl border border-ag-border bg-ag-surface-2 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted">Legenda</p>
              <button
                type="button"
                className="text-xs text-ag-accent hover:underline shrink-0"
                onClick={onNavigatePosts}
              >
                Editar em Planejamento
              </button>
            </div>
            {caption ? (
              <p className="text-sm leading-relaxed text-ag-text whitespace-pre-wrap break-words">
                {caption}
              </p>
            ) : (
              <p className="text-sm text-ag-muted italic">
                Sem legenda. Gere ou edite em Planejamento e legendas.
              </p>
            )}
          </section>

          {showPreview && (
            <section className="rounded-xl border border-ag-border bg-ag-surface-2 p-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted mb-3 text-center">
                {MSG_SOCIAL_PREVIEW}
              </p>
              <div className="flex justify-center">
                <InstagramPhonePreview post={mockPost} username={instagramHandle} variant="compact" />
              </div>
            </section>
          )}

          {item.status === "published" && item.permalink && (
            <a
              href={item.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ag-accent inline-flex items-center gap-1 hover:underline"
            >
              {MSG_VIEW_ON_NETWORK} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {isFailed && item.lastError && (
            <p className="text-sm text-ag-danger rounded-lg border border-ag-danger/30 bg-ag-danger/5 p-3">
              {item.lastError}
            </p>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-ag-border flex flex-col gap-2">
          {(isEligible || isQueued) && (
            <>
              {isEligible && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={saving}
                  onClick={handleSaveDraft}
                >
                  Salvar rascunho
                </Button>
              )}
              <Button
                type="button"
                variant="accent"
                className="w-full"
                disabled={saving || !canSchedule}
                onClick={() => void handleSchedule()}
              >
                {saving ? "Salvando…" : isEligible ? "Agendar post" : "Salvar horário"}
              </Button>
              {isEligible && hasDraft && onClearDraft && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-ag-muted"
                  disabled={saving}
                  onClick={handleClearDraft}
                >
                  Remover rascunho
                </Button>
              )}
            </>
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
