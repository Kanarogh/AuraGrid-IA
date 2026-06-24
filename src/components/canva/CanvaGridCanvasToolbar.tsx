import { ZoomIn, ZoomOut } from "lucide-react";
import type { CanvaGridFormat } from "../../lib/canvaGridFormats";
import type { CanvaGridFormatId } from "../../lib/canvaGridFormats";
import { cn } from "../../lib/cn";
import { IconButton } from "../ui/IconButton";
import { CanvaGridFormatPicker } from "./CanvaGridFormatPicker";

export function CanvaGridCanvasToolbar({
  format,
  formatMeta,
  maxWidth,
  onFormatChange,
  onZoomChange,
}: {
  format: CanvaGridFormatId;
  formatMeta: CanvaGridFormat;
  maxWidth: number;
  onFormatChange: (format: CanvaGridFormatId) => void;
  onZoomChange: (width: number) => void;
}) {
  const atMax = maxWidth >= formatMeta.zoomMax - 20;

  return (
    <div
      className={cn(
        "@container/canvas-toolbar rounded-xl border border-ag-border bg-ag-surface-2/60 px-3 py-3",
        "flex flex-col gap-3 @xl/canvas-toolbar:flex-row @xl/canvas-toolbar:items-center @xl/canvas-toolbar:justify-between"
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 @md/canvas-toolbar:flex-row @md/canvas-toolbar:items-center @md/canvas-toolbar:flex-wrap">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-ag-muted shrink-0">
          Formato
        </span>
        <CanvaGridFormatPicker
          variant="compact"
          value={format}
          onChange={onFormatChange}
          className="w-full @md/canvas-toolbar:w-auto"
        />
        <span className="text-[10px] text-ag-muted font-mono shrink-0 @md/canvas-toolbar:ml-1">
          {formatMeta.dimensions}px
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-2 @xl/canvas-toolbar:shrink-0">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-ag-muted shrink-0">
          Zoom
        </span>
        <IconButton
          label="Diminuir grid"
          variant="surface"
          size="sm"
          onClick={() => onZoomChange(maxWidth - 80)}
        >
          <ZoomOut className="h-4 w-4" />
        </IconButton>
        <input
          type="range"
          min={formatMeta.zoomMin}
          max={formatMeta.zoomMax}
          step={40}
          value={Math.min(maxWidth, formatMeta.zoomMax)}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="min-w-0 flex-1 @md/canvas-toolbar:w-32 @xl/canvas-toolbar:w-36 accent-ag-accent"
          aria-label="Zoom do grid"
        />
        <span className="text-[10px] font-mono text-ag-muted w-11 shrink-0 text-right tabular-nums">
          {maxWidth}px
          {atMax && <span className="text-ag-accent ml-0.5">·</span>}
        </span>
        <IconButton
          label="Aumentar grid"
          variant="surface"
          size="sm"
          onClick={() => onZoomChange(maxWidth + 80)}
        >
          <ZoomIn className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}
