"use client";

import { AlertTriangle, FlaskConical, Instagram, Link2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { startMetaOAuth } from "../../lib/publish/publishApi";

export function PublishHubStatusStrip({
  clientId,
  connected,
  publishMockEnabled,
  canSchedule,
  draftCount,
  conflictCount,
  confirmDisabled,
  onConfirmDrafts,
  onOpenSettings,
  className,
}: {
  clientId: string;
  connected: boolean;
  publishMockEnabled: boolean;
  canSchedule: boolean;
  draftCount: number;
  conflictCount: number;
  confirmDisabled: boolean;
  onConfirmDrafts: () => void;
  onOpenSettings: () => void;
  className?: string;
}) {
  const showConnect = !connected && !publishMockEnabled;
  const showMock = publishMockEnabled && !connected;
  const showDrafts = draftCount > 0;
  const showConflicts = conflictCount > 0;

  if (!showConnect && !showMock && !showDrafts && !showConflicts) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 py-1.5",
        className
      )}
    >
      {showConnect && (
        <span className="inline-flex items-center gap-2 rounded-lg border border-ag-border bg-ag-surface-2/80 px-2.5 py-1 text-xs text-ag-muted">
          <Instagram className="h-3.5 w-3.5 shrink-0" />
          <span>Instagram não conectado</span>
          <button
            type="button"
            onClick={() => startMetaOAuth(clientId)}
            className="inline-flex items-center gap-1 font-medium text-ag-accent hover:underline ag-focus-ring rounded"
          >
            <Link2 className="h-3 w-3" />
            Conectar
          </button>
          <span className="text-ag-muted/50">·</span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-ag-muted hover:text-ag-text ag-focus-ring rounded"
          >
            Config
          </button>
        </span>
      )}

      {showMock && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400">
          <FlaskConical className="h-3.5 w-3.5 shrink-0" />
          Simulação — agendar sem conectar
        </span>
      )}

      {showDrafts && (
        <span className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-ag-text">
          <strong>{draftCount}</strong>
          {draftCount === 1 ? "rascunho" : "rascunhos"}
          <Button
            type="button"
            variant="accent"
            size="sm"
            className="h-6 px-2 text-[11px]"
            disabled={confirmDisabled || !canSchedule}
            onClick={onConfirmDrafts}
          >
            Confirmar
          </Button>
        </span>
      )}

      {showConflicts && (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-ag-warning/30 bg-ag-warning/10 px-2.5 py-1 text-xs text-ag-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {conflictCount} conflito{conflictCount === 1 ? "" : "s"} de horário
        </span>
      )}
    </div>
  );
}
