"use client";

import { CheckCircle2, Loader2, Square, Upload, X } from "lucide-react";
import { cn } from "../../lib/cn";
import type { CatalogUploadProgressState } from "../../lib/catalogUploadProgress";
import { formatUploadBytes, formatUploadEta } from "../../lib/uploadProgress";
import { Button } from "../ui/Button";

export function CatalogUploadProgressPanel({
  progress,
  onCancel,
  onDismiss,
}: {
  progress: CatalogUploadProgressState | null;
  onCancel?: () => void;
  onDismiss?: () => void;
}) {
  if (!progress) return null;

  const isDone = progress.phase === "done";
  const isActive = progress.phase === "uploading" || progress.phase === "processing";
  const hasFailures = progress.failed > 0;

  return (
    <div
      className={cn(
        "pointer-events-auto fixed bottom-4 left-4 z-[95] w-[min(100vw-2rem,22rem)]",
        "rounded-2xl border border-ag-border bg-ag-surface-1/98 shadow-[var(--ag-shadow-lg)] backdrop-blur-md",
        "animate-ag-toast-in overflow-hidden"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ag-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {isDone ? (
            <CheckCircle2
              className={cn(
                "h-4 w-4 shrink-0",
                hasFailures ? "text-ag-warning" : "text-ag-success"
              )}
            />
          ) : (
            <Upload className="h-4 w-4 shrink-0 text-ag-accent" />
          )}
          <p className="truncate text-sm font-semibold text-ag-text">
            {isDone
              ? hasFailures
                ? "Envio concluído com avisos"
                : "Envio concluído"
              : "Enviando para o catálogo"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isActive && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-1.5 text-ag-muted transition-colors hover:bg-ag-surface-2 hover:text-ag-danger ag-focus-ring"
              title="Cancelar envio"
              aria-label="Cancelar envio"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          )}
          {(isDone || progress.phase === "error") && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg p-1.5 text-ag-muted transition-colors hover:bg-ag-surface-2 hover:text-ag-text ag-focus-ring"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-ag-muted">
            <span className="font-mono tabular-nums">
              {isDone
                ? `${progress.succeeded} de ${progress.total} enviado${progress.succeeded !== 1 ? "s" : ""}`
                : `${Math.min(progress.current, progress.total)} de ${progress.total}`}
            </span>
            <span className="font-mono tabular-nums">{progress.overallPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ag-surface-3">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300 ease-out",
                isDone && !hasFailures ? "bg-ag-success" : "bg-ag-accent"
              )}
              style={{ width: `${progress.overallPercent}%` }}
            />
          </div>
        </div>

        {!isDone && (
          <>
            <div className="flex items-start gap-2 text-xs">
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-ag-accent" />
              <div className="min-w-0">
                <p className="truncate font-medium text-ag-text" title={progress.fileName}>
                  {progress.fileName || "Aguardando…"}
                </p>
                {progress.label ? (
                  <p className="truncate text-ag-muted" title={progress.label}>
                    {progress.label}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-ag-muted">
              <span>{formatUploadEta(progress.etaSeconds)}</span>
              {progress.bytesTotal > 0 && (
                <span className="font-mono tabular-nums">
                  {formatUploadBytes(progress.bytesLoaded)} / {formatUploadBytes(progress.bytesTotal)}
                </span>
              )}
            </div>
          </>
        )}

        {isDone && (
          <p className="text-xs text-ag-muted leading-relaxed">
            {progress.statusMessage}
            {progress.failed > 0 && (
              <span className="mt-1 block text-ag-warning">
                {progress.failed} arquivo{progress.failed !== 1 ? "s" : ""} não{" "}
                {progress.failed !== 1 ? "foram" : "foi"} enviado{progress.failed !== 1 ? "s" : ""}.
              </span>
            )}
          </p>
        )}

        {isActive && progress.statusMessage && (
          <p className="text-[10.5px] text-ag-muted">{progress.statusMessage}</p>
        )}
      </div>

      {isDone && onDismiss && (
        <div className="border-t border-ag-border px-4 py-2.5">
          <Button variant="secondary" size="sm" className="w-full" onClick={onDismiss}>
            Fechar
          </Button>
        </div>
      )}
    </div>
  );
}
