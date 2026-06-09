import { cn } from "../../lib/cn";
import {
  CANVA_GRID_FORMATS,
  formatPreviewSize,
  type CanvaGridFormatId,
} from "../../lib/canvaGridFormats";

export function CanvaGridFormatPicker({
  value,
  onChange,
}: {
  value: CanvaGridFormatId;
  onChange: (format: CanvaGridFormatId) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      {CANVA_GRID_FORMATS.map((format) => {
        const active = value === format.id;
        const preview = formatPreviewSize(format);

        return (
          <button
            key={format.id}
            type="button"
            onClick={() => onChange(format.id)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 transition-all cursor-pointer",
              "bg-white dark:bg-stone-900 shadow-sm hover:shadow-md",
              active
                ? "border-ag-accent ring-2 ring-ag-accent/25"
                : "border-stone-200 dark:border-stone-800 hover:border-ag-accent/40"
            )}
          >
            <div
              className={cn(
                "rounded-xl shadow-inner flex items-center justify-center shrink-0",
                format.previewBg
              )}
              style={{ width: preview.width, height: preview.height }}
            >
              <span className={cn("text-sm font-bold font-display", format.accent)}>
                {format.ratioLabel}
              </span>
            </div>
            <div className="text-center min-w-0">
              <p className="text-sm font-semibold text-ag-text">{format.label}</p>
              <p className="text-[10px] text-ag-muted font-mono mt-0.5">{format.dimensions}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
