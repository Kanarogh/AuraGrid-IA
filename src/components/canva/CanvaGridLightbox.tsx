import { useCallback, useEffect, useRef, useState } from "react";
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
  const [zoomIndex, setZoomIndex] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [canPan, setCanPan] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const zoom = ZOOM_STEPS[zoomIndex] ?? 1;

  const zoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(0, i - 1));
  }, []);

  const updateCanPan = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const overflow =
      el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    setCanPan(overflow);
  }, []);

  useEffect(() => {
    setNaturalSize(null);
    setZoomIndex(0);
    setIsDragging(false);
  }, [image]);

  useEffect(() => {
    updateCanPan();
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateCanPan);
    ro.observe(el);
    window.addEventListener("resize", updateCanPan);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateCanPan);
    };
  }, [zoom, naturalSize, updateCanPan]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomIn, zoomOut]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const el = viewportRef.current;
      if (!el) return;
      el.scrollLeft = dragRef.current.scrollLeft - (e.clientX - dragRef.current.x);
      el.scrollTop = dragRef.current.scrollTop - (e.clientY - dragRef.current.y);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canPan || e.button !== 0) return;
    const el = viewportRef.current;
    if (!el) return;
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  };

  const displayW = naturalSize ? Math.round(naturalSize.w * zoom) : undefined;
  const displayH = naturalSize ? Math.round(naturalSize.h * zoom) : undefined;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/92 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Visualização ampliada"
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
        ref={viewportRef}
        className={cn(
          "flex-1 min-h-0 overflow-auto ag-scrollbar-thin p-2 sm:p-4",
          canPan && (isDragging ? "cursor-grabbing" : "cursor-grab")
        )}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
      >
        <div className="min-w-full min-h-full flex items-center justify-center">
          <img
            src={image}
            alt={label || "Look ampliado"}
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            }}
            className={cn(
              "rounded-sm shadow-2xl object-contain select-none",
              "transition-[width,height] duration-150 ease-out",
              !naturalSize &&
                "max-w-[min(96vw,calc(100vh-5rem))] max-h-[min(96vw,calc(100vh-5rem))] w-auto h-auto"
            )}
            style={
              naturalSize
                ? {
                    width: displayW,
                    height: displayH,
                    maxWidth: "none",
                    maxHeight: "none",
                  }
                : undefined
            }
          />
        </div>
      </div>

      <p className="text-[10px] text-center text-white/40 pb-3 shrink-0">
        {canPan ? "Arraste para mover · " : ""}+ / − para zoom · Esc para fechar
      </p>
    </div>
  );
}
