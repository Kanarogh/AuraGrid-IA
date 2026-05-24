import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  RefreshCw,
  Sparkles,
  Square,
  ArrowRight,
} from "lucide-react";
import type { CaptionBatchStats } from "../../lib/captionBatch";
import { Button } from "../ui/Button";

export type CaptionBatchProgress = {
  current: number;
  total: number;
  label: string;
};

export function CaptionBatchPanel({
  stats,
  isRunning,
  progress,
  onGeneratePending,
  onRegenerateErrors,
  onStop,
  onReviewAll,
  compact = false,
}: {
  stats: CaptionBatchStats;
  isRunning: boolean;
  progress: CaptionBatchProgress | null;
  onGeneratePending: () => void;
  onRegenerateErrors: () => void;
  onStop: () => void;
  onReviewAll: () => void;
  compact?: boolean;
}) {
  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const canGenerate = stats.pending > 0 && !isRunning;
  const catalogWarning = stats.catalogTotal > 0 && !stats.catalogReady;

  if (compact) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-ag-border/70 bg-ag-surface-1/90 backdrop-blur-sm px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-ag-text flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-ag-accent shrink-0" />
            {stats.pending > 0
              ? `${stats.pending} legenda${stats.pending !== 1 ? "s" : ""} pendente${stats.pending !== 1 ? "s" : ""}`
              : "Todas as legendas foram geradas"}
          </p>
          <p className="text-[10px] text-ag-muted mt-0.5">
            {stats.withImage}/{stats.total} com foto · {stats.confirmed} aprovadas
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {isRunning ? (
            <Button variant="danger" size="sm" onClick={onStop} type="button">
              Parar
            </Button>
          ) : (
            <Button
              variant="accent"
              size="sm"
              onClick={onGeneratePending}
              disabled={!canGenerate}
              type="button"
            >
              Gerar pendentes
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ag-border/70 bg-ag-surface-1 p-4 sm:p-5 space-y-4 shadow-[var(--ag-shadow)]">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ag-text flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ag-accent" />
            Gerar legendas com IA
          </h2>
          <p className="text-xs text-ag-muted mt-1 max-w-xl">
            Fotos → catálogo indexado → legendas → revisão. Tom da IA em Configurações.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onReviewAll} type="button">
          Revisar todas
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
        <Step
          n={1}
          title="Fotos nos posts"
          done={stats.withImage === stats.total && stats.total > 0}
          detail={`${stats.withImage}/${stats.total}`}
        />
        <Step
          n={2}
          title="Catálogo indexado"
          done={stats.catalogTotal === 0 || stats.catalogReady}
          warn={catalogWarning}
          detail={
            stats.catalogTotal === 0
              ? "Sem refs."
              : `${stats.catalogIndexed}/${stats.catalogTotal}`
          }
        />
        <Step
          n={3}
          title="Legendas geradas"
          done={stats.generated > 0 && stats.pending === 0}
          detail={`${stats.generated} prontas`}
        />
        <Step
          n={4}
          title="Aprovadas"
          done={stats.confirmed === stats.total && stats.total > 0}
          detail={`${stats.confirmed}/${stats.total}`}
        />
      </ol>

      <div className="flex flex-wrap gap-2 text-[10px] font-mono">
        <StatChip label="Com foto" value={stats.withImage} />
        <StatChip label="Pendentes IA" value={stats.pending} accent />
        <StatChip label="Rascunho" value={stats.generated - stats.confirmed} />
        <StatChip label="Aprovadas" value={stats.confirmed} success />
        {stats.errors > 0 && <StatChip label="Com erro" value={stats.errors} danger />}
      </div>

      {catalogWarning && (
        <div className="flex gap-2 text-xs text-ag-warning bg-ag-warning/10 border border-ag-warning/25 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            <strong>Catálogo incompleto:</strong> indexe as referências na aba Catálogo antes de
            gerar em massa — assim a IA usa JSON (mais barato e preciso). Sem índice, cada legenda
            pode enviar todas as fotos do acervo.
          </p>
        </div>
      )}

      {stats.withoutImage > 0 && (
        <div className="flex gap-2 text-xs text-ag-muted bg-ag-surface-2 border border-ag-border rounded-xl p-3">
          <ImageIcon className="h-4 w-4 shrink-0" />
          <p>
            {stats.withoutImage} post(s) ainda sem foto — não entram na fila até você carregar a
            imagem do Canva.
          </p>
        </div>
      )}

      {isRunning && progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-mono text-ag-muted">
            <span>
              Gerando {progress.current}/{progress.total}
              {progress.label ? ` — ${progress.label}` : ""}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-ag-surface-2 overflow-hidden">
            <div
              className="h-full bg-ag-accent transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {isRunning ? (
          <Button variant="danger" size="sm" onClick={onStop} type="button">
            <Square className="h-3.5 w-3.5 fill-current" />
            Parar geração
          </Button>
        ) : (
          <>
            <Button
              variant="accent"
              size="sm"
              onClick={onGeneratePending}
              disabled={!canGenerate}
              type="button"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Gerar {stats.pending} pendente{stats.pending !== 1 ? "s" : ""}
            </Button>
            {stats.errors > 0 && (
              <Button variant="secondary" size="sm" onClick={onRegenerateErrors} type="button">
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente ({stats.errors} erro{stats.errors !== 1 ? "s" : ""})
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  detail,
  done,
  warn,
}: {
  n: number;
  title: string;
  detail: string;
  done?: boolean;
  warn?: boolean;
}) {
  return (
    <li
      className={`rounded-xl border px-2.5 py-2 ${
        done
          ? "border-ag-success/30 bg-ag-success/5"
          : warn
            ? "border-ag-warning/30 bg-ag-warning/5"
            : "border-ag-border bg-ag-surface-2"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className={`h-4 w-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
            done ? "bg-ag-success text-white" : "bg-ag-surface-3 text-ag-muted"
          }`}
        >
          {done ? <CheckCircle2 className="h-3 w-3" /> : n}
        </span>
        <span className="font-semibold text-ag-text truncate">{title}</span>
      </div>
      <span className="text-ag-muted block pl-5">{detail}</span>
    </li>
  );
}

function StatChip({
  label,
  value,
  accent,
  success,
  danger,
}: {
  label: string;
  value: number;
  accent?: boolean;
  success?: boolean;
  danger?: boolean;
}) {
  return (
    <span
      className={`px-2 py-1 rounded-lg border ${
        danger
          ? "border-ag-danger/30 bg-ag-danger/10 text-ag-danger"
          : success
            ? "border-ag-success/30 bg-ag-success/10 text-ag-success"
            : accent
              ? "border-ag-accent/30 bg-ag-accent/10 text-ag-accent"
              : "border-ag-border bg-ag-surface-2 text-ag-muted"
      }`}
    >
      {label}: <strong>{value}</strong>
    </span>
  );
}
