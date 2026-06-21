import { useState } from "react";
import { LayoutGrid, RefreshCw, ShoppingBag, Upload } from "lucide-react";
import { SchedulerPanel } from "../shared/SchedulerPanel";
import { CanvaTimelineSyncPanel } from "../canva/CanvaTimelineSyncPanel";
import { WorkspaceCard, WorkspaceCardHeader } from "../layout/WorkspaceCard";
import { cn } from "../../lib/cn";

type SetupTab = "catalog" | "upload" | "canva";

export function PopularCalendarioPanel({
  startDate,
  onStartDateChange,
  postsCount,
  catalogCount,
  onAddDay,
  onDistributeCatalog,
  onBatchUpload,
  isReadOnly,
  autoSync,
  onAutoSyncChange,
  canvaGridReversed,
  onCanvaGridReversedChange,
  onSyncNow,
  canvaImageCount,
  onOpenCanvaGrid,
}: {
  startDate: string;
  onStartDateChange: (date: string) => void;
  postsCount: number;
  catalogCount: number;
  onAddDay: () => void;
  onDistributeCatalog: () => void;
  onBatchUpload: (files: FileList) => void;
  isReadOnly?: boolean;
  autoSync: boolean;
  onAutoSyncChange: (enabled: boolean) => void;
  canvaGridReversed: boolean;
  onCanvaGridReversedChange: (reversed: boolean) => void;
  onSyncNow: () => void;
  canvaImageCount: number;
  onOpenCanvaGrid?: () => void;
}) {
  const [tab, setTab] = useState<SetupTab>("catalog");

  const tabs: { id: SetupTab; label: string; icon: typeof ShoppingBag }[] = [
    { id: "catalog", label: "Catálogo", icon: ShoppingBag },
    { id: "upload", label: "Upload", icon: Upload },
    { id: "canva", label: "Grid Canva", icon: LayoutGrid },
  ];

  return (
    <WorkspaceCard variant="primary" className="!p-0 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-ag-border/60">
        <WorkspaceCardHeader
          title="Popular calendário"
          subtitle="Escolha como preencher os 30 dias do roteiro ativo."
        />
        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-ag-surface-2 border border-ag-border">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ag-focus-ring",
                tab === id
                  ? "bg-ag-surface-1 text-ag-text shadow-sm border border-ag-border"
                  : "text-ag-muted hover:text-ag-text"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {tab === "canva" ? (
          <CanvaTimelineSyncPanel
            autoSync={autoSync}
            onAutoSyncChange={onAutoSyncChange}
            canvaGridReversed={canvaGridReversed}
            onCanvaGridReversedChange={onCanvaGridReversedChange}
            onSyncNow={onSyncNow}
            canvaImageCount={canvaImageCount}
            onOpenCanvaGrid={onOpenCanvaGrid}
          />
        ) : (
          <>
            <div className="rounded-lg border border-ag-border/50 bg-ag-surface-2/50 px-3 py-2 text-xs text-ag-muted flex items-start gap-2">
              <RefreshCw className="h-3.5 w-3.5 shrink-0 mt-0.5 text-ag-accent" />
              {tab === "catalog"
                ? "Distribui looks já cadastrados no catálogo, na ordem do acervo."
                : "Envie um lote de fotos para criar ou preencher dias automaticamente."}
            </div>
            <SchedulerPanel
              embedded
              startDate={startDate}
              onStartDateChange={onStartDateChange}
              postsCount={postsCount}
              catalogCount={catalogCount}
              onAddDay={onAddDay}
              onDistributeCatalog={onDistributeCatalog}
              onBatchUpload={onBatchUpload}
              isReadOnly={isReadOnly}
              showCatalogActions={tab === "catalog"}
              showUploadActions={tab === "upload"}
            />
          </>
        )}
      </div>
    </WorkspaceCard>
  );
}
