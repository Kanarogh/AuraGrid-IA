import { useCallback, useEffect, useState } from "react";
import { Minus, Plus, X, ZoomIn } from "lucide-react";
import { cn } from "../../lib/cn";

const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3] as const;

export function CanvaGridLightbox({
  image,
  label,
  slotNumber,
  onClose,
}: {
  image: string;
  label: string | null;
  slotNumber?: number;
  onClose: () => void;
}) {
  const [zoomIndex, setZoomIndex] = useState(3);

  const zoom = ZOOM_STEPS[zoomIndex] ?? 1.5;

  const zoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomIn, zoomOut]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/92 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Visualização ampliada do grid"
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 shrink-0 border-b border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-white/90 text-sm font-medium min-w-0">
          <ZoomIn className="h-4 w-4 shrink-0" />
          {slotNumber != null && <span className="shrink-0">L{slotNumber}</span>}
          {label && (
            <span className="truncate max-w-[min(50vw,28rem)] text-white/70">— {label}</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoomIndex === 0}
            className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer disabled:opacity-30"
            title="Diminuir zoom"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-xs font-mono text-white/80 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer disabled:opacity-30"
            title="Aumentar zoom"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer ml-1"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-auto ag-scrollbar-thin flex items-center justify-center p-2 sm:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image}
          alt={label || "Look ampliado"}
          draggable={false}
          className={cn(
            "rounded-sm shadow-2xl object-contain select-none",
            "transition-[width] duration-150 ease-out"
          )}
          style={{
            width: `calc(min(96vw, calc(100vh - 5rem)) * ${zoom})`,
            maxWidth: "none",
            height: "auto",
          }}
        />
      </div>

      <p className="text-[10px] text-center text-white/40 pb-3 shrink-0">
        Scroll para mover · + / − para zoom · Esc para fechar
      </p>
    </div>
  );
}
