import { cn } from "../../lib/cn";
import { PANEL_PCT_MAX, PANEL_PCT_MIN, PANEL_PCT_STEP } from "../../lib/canvaWardrobeLayout";

export function CanvaGridSplitHandle({
  isResizing,
  panelWidthPct,
  onResizeStart,
  onNudge,
}: {
  isResizing: boolean;
  panelWidthPct: number;
  onResizeStart: (clientX: number) => void;
  onNudge: (delta: number) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar grid e guarda-roupa"
      aria-valuenow={panelWidthPct}
      aria-valuemin={PANEL_PCT_MIN}
      aria-valuemax={PANEL_PCT_MAX}
      tabIndex={0}
      title="Arraste para redimensionar"
      onMouseDown={(e) => {
        e.preventDefault();
        onResizeStart(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onNudge(-PANEL_PCT_STEP);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onNudge(PANEL_PCT_STEP);
        }
      }}
      className={cn(
        "hidden xl:flex relative w-2 shrink-0 self-stretch cursor-col-resize group select-none touch-none",
        isResizing && "z-20"
      )}
    >
      <div
        className={cn(
          "absolute inset-y-6 left-1/2 -translate-x-1/2 w-px rounded-full transition-all",
          "bg-ag-border group-hover:w-0.5 group-hover:bg-ag-accent/60",
          isResizing && "w-1 bg-ag-accent shadow-[0_0_0_3px_var(--ag-accent-soft)]"
        )}
      />
      <div className="absolute -inset-x-2 inset-y-0" aria-hidden />
    </div>
  );
}
