import {
  ArrowDown,
  ArrowUp,
  LayoutGrid,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  buildDistributionPreview,
  type DistributionPrefs,
  type MaxPostsPerDay,
  type SparseStrategy,
} from "../../lib/smartDistribution";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";

export function SmartDistributorPanel({
  canvaImageCount,
  distributionPrefs,
  onDistributionPrefsChange,
  canvaGridReversed,
  onCanvaGridReversedChange,
  autoSync,
  onAutoSyncChange,
  onSyncNow,
  onDistributeFromGrid,
  onOpenCanvaGrid,
  isReadOnly = false,
}: {
  canvaImageCount: number;
  distributionPrefs: DistributionPrefs;
  onDistributionPrefsChange: (partial: Partial<DistributionPrefs>) => void;
  canvaGridReversed: boolean;
  onCanvaGridReversedChange: (reversed: boolean) => void;
  autoSync: boolean;
  onAutoSyncChange: (enabled: boolean) => void;
  onSyncNow: () => void;
  onDistributeFromGrid: () => void;
  onOpenCanvaGrid?: () => void;
  isReadOnly?: boolean;
}) {
  const preview = buildDistributionPreview(canvaImageCount, distributionPrefs);
  const maxOptions: MaxPostsPerDay[] = [1, 2, 3];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-ag-accent font-semibold mb-1">
            Fonte: Grid Canva
          </p>
          <p className="text-sm text-ag-muted leading-relaxed">
            {canvaImageCount > 0 ? (
              <>
                <strong className="text-ag-text">{canvaImageCount}</strong> look
                {canvaImageCount === 1 ? "" : "s"} com foto prontos para distribuir na ordem do grid.
              </>
            ) : (
              <>
                Monte looks no Grid Canva primeiro.{" "}
                {onOpenCanvaGrid && (
                  <button
                    type="button"
                    onClick={onOpenCanvaGrid}
                    className="text-ag-accent font-semibold hover:underline cursor-pointer"
                  >
                    Abrir Grid Canva
                  </button>
                )}
              </>
            )}
          </p>
        </div>
        <Badge tone={autoSync ? "success" : "neutral"} dot>
          {autoSync ? "Auto-sync ligado" : "Auto-sync desligado"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-ag-border bg-ag-surface-2 p-4 space-y-4">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ag-muted font-semibold">
            Regras de distribuição
          </p>

          <div>
            <p className="text-xs text-ag-muted mb-2">Máx. posts por dia</p>
            <div className="inline-flex rounded-lg border border-ag-border bg-ag-surface-1 p-0.5">
              {maxOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => onDistributionPrefsChange({ maxPostsPerDay: n })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer",
                    distributionPrefs.maxPostsPerDay === n
                      ? "bg-ag-accent text-white"
                      : "text-ag-muted hover:text-ag-text"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs text-ag-muted">Dias com múltiplos posts</p>
              <label className="flex items-center gap-1.5 text-[10px] text-ag-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={distributionPrefs.useAutoDenseDays !== false}
                  disabled={isReadOnly}
                  onChange={(e) =>
                    onDistributionPrefsChange({ useAutoDenseDays: e.target.checked })
                  }
                  className="rounded border-ag-border"
                />
                Sugerir automaticamente
              </label>
            </div>
            <input
              type="number"
              min={1}
              max={30}
              disabled={isReadOnly || distributionPrefs.useAutoDenseDays !== false}
              value={distributionPrefs.denseDaysCount}
              onChange={(e) =>
                onDistributionPrefsChange({
                  denseDaysCount: Math.max(1, Math.min(30, Number(e.target.value) || 1)),
                  useAutoDenseDays: false,
                })
              }
              className="w-full rounded-lg border border-ag-border bg-ag-surface-1 px-3 py-2 text-sm font-semibold"
            />
          </div>

          {canvaImageCount > 0 && canvaImageCount < 30 && (
            <div>
              <p className="text-xs text-ag-muted mb-2">Poucos looks (&lt; 30)</p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    ["sequential", "Sequencial — dias 1…N"],
                    ["spread", "Espalhar nos 30 dias"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-xs text-ag-text cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="sparseStrategy"
                      checked={distributionPrefs.sparseStrategy === value}
                      disabled={isReadOnly}
                      onChange={() =>
                        onDistributionPrefsChange({ sparseStrategy: value as SparseStrategy })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-ag-muted mb-2">Ordem do grid</p>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={isReadOnly}
              onClick={() => onCanvaGridReversedChange(!canvaGridReversed)}
            >
              {canvaGridReversed ? (
                <>
                  <ArrowDown className="h-3.5 w-3.5 text-ag-warning" />
                  Feed: de baixo p/ cima
                </>
              ) : (
                <>
                  <ArrowUp className="h-3.5 w-3.5 text-ag-success" />
                  Ordem L1 → L12
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-ag-border bg-ag-surface-1 p-4 space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ag-muted font-semibold">
            Preview ao vivo
          </p>
          <ul className="text-xs text-ag-muted space-y-1.5">
            {preview.summaryLines.map((line) => (
              <li key={line} className="leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
          <div className="flex gap-0.5 h-8 items-end pt-2">
            {preview.postsPerDay.map((count, i) => (
              <div
                key={i}
                title={`Dia ${i + 1}: ${count} post${count === 1 ? "" : "s"}`}
                className={cn(
                  "flex-1 min-w-0 rounded-sm transition-colors",
                  count === 0
                    ? "bg-ag-border/40 h-1"
                    : count === 1
                      ? "bg-ag-accent/35 h-4"
                      : count === 2
                        ? "bg-ag-accent/55 h-6"
                        : "bg-ag-accent h-8"
                )}
              />
            ))}
          </div>
          {preview.overflowCount > 0 && (
            <p className="text-[11px] text-ag-danger">
              Capacidade insuficiente — ajuste as regras antes de distribuir.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="accent"
          size="sm"
          type="button"
          disabled={isReadOnly || canvaImageCount === 0 || preview.overflowCount > 0}
          onClick={onDistributeFromGrid}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Distribuir do Grid Canva
        </Button>
        <Button
          variant={autoSync ? "primary" : "secondary"}
          size="sm"
          type="button"
          disabled={isReadOnly}
          onClick={() => onAutoSyncChange(!autoSync)}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {autoSync ? "Desligar auto-sync" : "Ligar auto-sync"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          disabled={canvaImageCount === 0 || isReadOnly}
          onClick={onSyncNow}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Sincronizar agora
        </Button>
        {onOpenCanvaGrid && canvaImageCount > 0 && (
          <Button variant="ghost" size="sm" type="button" onClick={onOpenCanvaGrid}>
            <LayoutGrid className="h-3.5 w-3.5" />
            Ver grid
          </Button>
        )}
      </div>

      <p className="text-[11px] text-ag-muted leading-relaxed rounded-lg border border-ag-border/50 bg-ag-surface-2/50 px-3 py-2">
        O catálogo serve para match de referência e legendas — não para popular o calendário.
        Use o Grid Canva como sequência visual oficial do mês.
      </p>
    </div>
  );
}
