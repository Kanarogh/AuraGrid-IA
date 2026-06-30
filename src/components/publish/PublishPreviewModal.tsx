"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PlannedPost } from "../../types";
import { InstagramPhonePreview } from "../posts/InstagramPhonePreview";
import { Button } from "../ui/Button";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import { scheduledAtToLocalInput } from "./publishUiUtils";
import { queueItemToPlannedPost } from "./publishCalendarUtils";

export function PublishPreviewModal({
  open,
  items,
  instagramHandle,
  draftSchedules,
  scheduledAt,
  onClose,
  onConfirm,
  confirming,
}: {
  open: boolean;
  items: PublishQueueItem[];
  instagramHandle: string;
  draftSchedules?: Record<string, string>;
  scheduledAt?: string;
  onClose: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}) {
  const [index, setIndex] = useState(0);

  if (!open || items.length === 0) return null;

  const safeIndex = Math.min(index, items.length - 1);
  const preview = items[safeIndex]!;

  const resolveWhen = (item: PublishQueueItem) =>
    draftSchedules?.[item.plannedPostId] ?? item.scheduledAt ?? scheduledAt ?? null;

  const formatWhen = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("pt-BR", {
          dateStyle: "full",
          timeStyle: "short",
        })
      : "";

  const when = formatWhen(resolveWhen(preview));
  const count = items.length;
  const captionLong = preview.caption.length > 2200;
  const mockPost: PlannedPost = queueItemToPlannedPost(preview);

  const anyCaptionLong = items.some((i) => i.caption.length > 2200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-xl border border-ag-border bg-ag-surface-1 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-preview-title"
      >
        <div className="p-5 border-b border-ag-border">
          <h2 id="publish-preview-title" className="font-display text-xl font-semibold text-ag-text">
            Confirmar programação
          </h2>
          <p className="text-sm text-ag-muted mt-1">
            {count === 1
              ? "Revise como o post vai aparecer nas redes sociais."
              : `Post ${safeIndex + 1} de ${count} — revise cada um antes de confirmar.`}
          </p>
        </div>

        <div className="p-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {count > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={safeIndex === 0}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-ag-muted">
                  {safeIndex + 1} / {count}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={safeIndex >= count - 1}
                  onClick={() => setIndex((i) => Math.min(count - 1, i + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex justify-center">
              <InstagramPhonePreview post={mockPost} username={instagramHandle} />
            </div>
          </div>
          <div className="space-y-4">
            {when && (
              <div className="rounded-xl border border-ag-accent/30 bg-ag-accent-soft p-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted">
                  Publicação
                </p>
                <p className="text-lg font-semibold text-ag-text mt-1">{when}</p>
              </div>
            )}
            {count > 1 && (
              <ul className="space-y-2 max-h-32 overflow-auto text-sm">
                {items.map((item, i) => (
                  <li key={item.plannedPostId}>
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      className={`w-full flex justify-between gap-2 text-left px-2 py-1.5 rounded-lg ${
                        i === safeIndex ? "bg-ag-accent-soft text-ag-accent" : "text-ag-text hover:bg-ag-surface-2"
                      }`}
                    >
                      <span>Dia {item.dayNumber}</span>
                      <span className="font-medium text-xs">{formatWhen(resolveWhen(item))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted mb-2">
                Legenda
              </p>
              <p className="text-sm text-ag-text whitespace-pre-wrap break-words">{preview.caption}</p>
              {captionLong && (
                <p className="text-xs text-ag-warning mt-2">
                  Atenção: legenda acima do limite de algumas redes sociais (2200 caracteres).
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-ag-border flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={confirming}>
            Voltar
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={onConfirm}
            disabled={confirming || anyCaptionLong}
          >
            {confirming
              ? "Programando…"
              : count === 1
                ? "Programar este post"
                : `Programar ${count} posts`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function buildScheduledIsoFromInputs(date: string, time: string): string {
  const { date: d, time: t } = scheduledAtToLocalInput(null);
  const useDate = date || d;
  const useTime = time || t;
  return new Date(`${useDate}T${useTime}:00`).toISOString();
}
