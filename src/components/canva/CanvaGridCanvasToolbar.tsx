import { ZoomIn, ZoomOut } from "lucide-react";
import type { CanvaGridFormat } from "../../lib/canvaGridFormats";
import type { CanvaGridFormatId } from "../../lib/canvaGridFormats";
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
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-ag-border bg-ag-surface-2/60 px-3 py-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-ag-muted shrink-0">
          Formato
        </span>
        <CanvaGridFormatPicker variant="compact" value={format} onChange={onFormatChange} />
        <span className="text-[10px] text-ag-muted font-mono hidden md:inline shrink-0">
          {formatMeta.dimensions}px
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-ag-muted">
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
          className="w-28 sm:w-36 accent-ag-accent"
          aria-label="Zoom do grid"
        />
        <span className="text-[10px] font-mono text-ag-muted w-11 text-right tabular-nums">
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
