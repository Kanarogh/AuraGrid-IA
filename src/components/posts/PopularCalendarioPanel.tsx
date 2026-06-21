import { useState } from "react";
import { LayoutGrid, Upload } from "lucide-react";
import { SchedulerPanel } from "../shared/SchedulerPanel";
import { SmartDistributorPanel } from "./SmartDistributorPanel";
import { WorkspaceCard, WorkspaceCardHeader } from "../layout/WorkspaceCard";
import type { DistributionPrefs } from "../../lib/smartDistribution";
import { cn } from "../../lib/cn";

type SetupTab = "grid" | "upload";

export function PopularCalendarioPanel({
  startDate,
  onStartDateChange,
  postsCount,
  onAddDay,
  onBatchUpload,
  isReadOnly,
  autoSync,
  onAutoSyncChange,
  canvaGridReversed,
  onCanvaGridReversedChange,
  onSyncNow,
  onDistributeFromGrid,
  canvaImageCount,
  distributionPrefs,
  onDistributionPrefsChange,
  onOpenCanvaGrid,
}: {
  startDate: string;
  onStartDateChange: (date: string) => void;
  postsCount: number;
  onAddDay: () => void;
  onBatchUpload: (files: FileList) => void;
  isReadOnly?: boolean;
  autoSync: boolean;
  onAutoSyncChange: (enabled: boolean) => void;
  canvaGridReversed: boolean;
  onCanvaGridReversedChange: (reversed: boolean) => void;
  onSyncNow: () => void;
  onDistributeFromGrid: () => void;
  canvaImageCount: number;
  distributionPrefs: DistributionPrefs;
  onDistributionPrefsChange: (partial: Partial<DistributionPrefs>) => void;
  onOpenCanvaGrid?: () => void;
}) {
  const [tab, setTab] = useState<SetupTab>("grid");

  const tabs: { id: SetupTab; label: string; icon: typeof LayoutGrid }[] = [
    { id: "grid", label: "Grid Canva", icon: LayoutGrid },
    { id: "upload", label: "Upload", icon: Upload },
  ];

  return (
    <WorkspaceCard variant="primary" className="!p-0 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-ag-border/60">
        <WorkspaceCardHeader
          title="Popular calendário"
          subtitle="Distribua looks do Grid Canva no roteiro de 30 dias com regras ajustáveis."
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
        {tab === "grid" ? (
          <SmartDistributorPanel
            canvaImageCount={canvaImageCount}
            distributionPrefs={distributionPrefs}
            onDistributionPrefsChange={onDistributionPrefsChange}
            canvaGridReversed={canvaGridReversed}
            onCanvaGridReversedChange={onCanvaGridReversedChange}
            autoSync={autoSync}
            onAutoSyncChange={onAutoSyncChange}
            onSyncNow={onSyncNow}
            onDistributeFromGrid={onDistributeFromGrid}
            onOpenCanvaGrid={onOpenCanvaGrid}
            isReadOnly={isReadOnly}
          />
        ) : (
          <>
            <p className="text-xs text-ag-muted rounded-lg border border-ag-border/50 bg-ag-surface-2/50 px-3 py-2">
              Upload em lote aplica as mesmas regras de distribuição configuradas na aba Grid Canva.
            </p>
            <SchedulerPanel
              embedded
              startDate={startDate}
              onStartDateChange={onStartDateChange}
              postsCount={postsCount}
              onAddDay={onAddDay}
              onBatchUpload={onBatchUpload}
              isReadOnly={isReadOnly}
            />
          </>
        )}
      </div>
    </WorkspaceCard>
  );
}
