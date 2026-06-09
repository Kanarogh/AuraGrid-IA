import { cn } from "../../lib/cn";
import {
  CANVA_GRID_FORMATS,
  formatPreviewSize,
  type CanvaGridFormatId,
} from "../../lib/canvaGridFormats";

export function CanvaGridFormatPicker({
  value,
  onChange,
  variant = "default",
}: {
  value: CanvaGridFormatId;
  onChange: (format: CanvaGridFormatId) => void;
  variant?: "default" | "compact";
}) {
  if (variant === "compact") {
    return (
      <div
        role="radiogroup"
        aria-label="Formato do grid"
        className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-ag-border bg-ag-surface-2 p-1"
      >
        {CANVA_GRID_FORMATS.map((format) => {
          const active = value === format.id;
          return (
            <button
              key={format.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={`${format.label} · ${format.dimensions}px`}
              onClick={() => onChange(format.id)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ag-focus-ring",
                active
                  ? "bg-ag-surface-1 text-ag-text shadow-sm ring-1 ring-ag-accent/20"
                  : "text-ag-muted hover:text-ag-text"
              )}
            >
              <span className="font-mono">{format.ratioLabel}</span>
              <span className="hidden sm:inline text-ag-muted font-normal ml-1">
                {format.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

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
              "bg-ag-surface-1 shadow-sm hover:shadow-md",
              active
                ? "border-ag-accent ring-2 ring-ag-accent/25"
                : "border-ag-border hover:border-ag-accent/40"
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
