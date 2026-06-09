import { ArrowDown, ArrowUp, LayoutGrid, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { Badge } from "../ui/Badge";

export function CanvaTimelineSyncPanel({
  autoSync,
  onAutoSyncChange,
  canvaGridReversed,
  onCanvaGridReversedChange,
  onSyncNow,
  canvaImageCount,
  onOpenCanvaGrid,
}: {
  autoSync: boolean;
  onAutoSyncChange: (enabled: boolean) => void;
  canvaGridReversed: boolean;
  onCanvaGridReversedChange: (reversed: boolean) => void;
  onSyncNow: () => void;
  canvaImageCount: number;
  onOpenCanvaGrid?: () => void;
}) {
  return (
    <Card variant="muted" className="ag-studio relative overflow-hidden mb-4 border-ag-border/70" padding="sm">
      <CardHeader
        icon={<RefreshCw className={`h-5 w-5 ${autoSync ? "animate-spin [animation-duration:4s]" : ""}`} />}
        title="Espelhar Grid Canva no roteiro"
        description="Atualiza as fotos dos 30 dias conforme a sequência montada no Grid Canva. Legendas, aprovações e textos já feitos no dia são mantidos; só a foto do slot pode trocar."
        action={
          <Badge tone={autoSync ? "success" : "neutral"} dot>
            {autoSync ? "Auto-sync ligado" : "Auto-sync desligado"}
          </Badge>
        }
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <p className="text-xs text-ag-muted leading-relaxed max-w-xl">
          {canvaImageCount > 0 ? (
            <>
              <strong className="text-ag-text">{canvaImageCount}</strong> look
              {canvaImageCount === 1 ? "" : "s"} com foto no grid prontos para espelhar no calendário.
            </>
          ) : (
            <>
              Nenhuma foto no Grid Canva ainda.{" "}
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

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant={autoSync ? "primary" : "secondary"}
            size="sm"
            type="button"
            onClick={() => onAutoSyncChange(!autoSync)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {autoSync ? "Desligar auto-sync" : "Ligar auto-sync"}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => onCanvaGridReversedChange(!canvaGridReversed)}
            title="Define se a leitura do grid segue L1→L12 ou de baixo para cima (feed Instagram)"
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

          <Button
            variant="accent"
            size="sm"
            type="button"
            onClick={onSyncNow}
            disabled={canvaImageCount === 0}
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
      </div>
    </Card>
  );
}

export function CanvaGridOrderHint({ onOpenRoteiros }: { onOpenRoteiros: () => void }) {
  return (
    <p className="text-xs text-ag-muted leading-relaxed">
      A ordem das fotos no grid alimenta o roteiro de 30 dias. Sincronização automática e manual ficam em{" "}
      <button
        type="button"
        onClick={onOpenRoteiros}
        className="text-ag-accent font-semibold hover:underline cursor-pointer"
      >
        Roteiros e legendas
      </button>
      .
    </p>
  );
}
