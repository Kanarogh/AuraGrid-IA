"use client";

import type { PlannedPost } from "../../types";
import { InstagramPhonePreview } from "../posts/InstagramPhonePreview";
import { Button } from "../ui/Button";
import type { PublishQueueItem } from "../../lib/publish/publishApi";
import { scheduledAtToLocalInput } from "./publishUiUtils";

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
  if (!open || items.length === 0) return null;

  const preview = items[0];
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

  const mockPost: PlannedPost = {
    id: preview.plannedPostId,
    dayNumber: preview.dayNumber,
    dateLabel: preview.dateLabel,
    image: preview.imageUrl,
    imageAssetId: preview.imageAssetId,
    matchedCatalogId: null,
    reasoning: null,
    caption: preview.caption,
    isGenerating: false,
    isGenerated: true,
    isConfirmed: true,
    error: null,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl border border-ag-border bg-ag-surface-1 shadow-2xl"
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
              ? "Revise como o post vai aparecer no Instagram."
              : `${count} posts serão agendados com os horários escolhidos.`}
          </p>
        </div>

        <div className="p-5 grid gap-6 lg:grid-cols-2">
          <div className="flex justify-center">
            <InstagramPhonePreview post={mockPost} username={instagramHandle} />
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
              <ul className="space-y-2 max-h-48 overflow-auto text-sm text-ag-text">
                {items.map((item) => (
                  <li key={item.plannedPostId} className="flex justify-between gap-2 border-b border-ag-border/50 pb-2">
                    <span className="text-ag-muted">Dia {item.dayNumber}</span>
                    <span className="font-medium">{formatWhen(resolveWhen(item))}</span>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted mb-2">
                Legenda
              </p>
              <p className="text-sm text-ag-text whitespace-pre-wrap line-clamp-8">{preview.caption}</p>
              {captionLong && (
                <p className="text-xs text-ag-warning mt-2">
                  Atenção: legenda acima do limite do Instagram (2200 caracteres).
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-ag-border flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={confirming}>
            Voltar
          </Button>
          <Button type="button" variant="accent" onClick={onConfirm} disabled={confirming || captionLong}>
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
