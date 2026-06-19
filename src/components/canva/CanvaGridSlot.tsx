import { useRef } from "react";
import { ImagePlus, Upload, ZoomIn, X } from "lucide-react";
import type { CanvaGridSlot as SlotType } from "../../types";
import { resolveSlotImage } from "../../lib/canva";
import { cn } from "../../lib/cn";
import { CatalogThumbnail } from "../ui/CatalogThumbnail";
import { IconButton } from "../ui/IconButton";

export function CanvaGridSlot({
  slot,
  slotNumber,
  aspectRatio,
  isSelected,
  isDragOver,
  isSwapMode,
  onSelect,
  onDoubleClickImage,
  onUpload,
  onRemove,
  onZoom,
  onStartSwap,
}: {
  slot: SlotType;
  slotNumber: number;
  aspectRatio: number;
  isSelected: boolean;
  isDragOver: boolean;
  /** Outro slot já está selecionado para troca */
  isSwapMode: boolean;
  onSelect: () => void;
  onDoubleClickImage: () => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onZoom: () => void;
  onStartSwap: () => void;
}) {
  const displayImage = resolveSlotImage(slot);
  const hasImage = !!displayImage;
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{ aspectRatio }}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Slot L${slotNumber}${slot.label ? `, ${slot.label}` : ", vazio"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (hasImage) onDoubleClickImage();
      }}
      className={cn(
        "relative overflow-hidden transition-all duration-200 cursor-pointer group outline-none",
        "focus-visible:ring-2 focus-visible:ring-ag-accent focus-visible:ring-offset-1 focus-visible:ring-offset-ag-surface-1",
        isSelected && "z-20",
        isDragOver && !isSelected && "z-10",
        !hasImage && !isSelected && "border border-dashed border-ag-border/80 bg-ag-surface-2/60",
        !hasImage && isSelected && "border-2 border-dashed border-ag-accent bg-ag-accent/8",
        isSwapMode && !isSelected && hasImage && "ring-1 ring-ag-accent/30"
      )}
    >
      {hasImage ? (
        <>
          <CatalogThumbnail
            src={displayImage}
            alt={slot.label || `Look ${slotNumber}`}
            imgClassName="object-cover"
          />
          {slot.matchedCatalogId && slot.label && (
            <div className="absolute bottom-0 inset-x-0 bg-black/55 backdrop-blur-[2px] text-[8px] font-medium text-white text-center py-1 px-1 truncate pointer-events-none">
              {slot.label}
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
          <ImagePlus
            className={cn(
              "h-5 w-5 transition-colors",
              isSelected ? "text-ag-accent" : "text-ag-muted/70 group-hover:text-ag-accent"
            )}
          />
          <span
            className={cn(
              "text-[9px] font-mono font-semibold uppercase tracking-wider",
              isSelected ? "text-ag-accent" : "text-ag-muted group-hover:text-ag-text"
            )}
          >
            Arraste ou clique
          </span>
        </div>
      )}

      {/* Slot index */}
      <div
        className={cn(
          "absolute top-1.5 left-1.5 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-mono font-bold",
          isSelected
            ? "bg-ag-accent text-ag-accent-fg shadow-sm"
            : "bg-black/55 text-white backdrop-blur-sm"
        )}
      >
        L{slotNumber}
      </div>

      {/* Selection frame */}
      {isSelected && (
        <div
          className="absolute inset-0 border-[3px] border-ag-accent pointer-events-none z-20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
          aria-hidden
        />
      )}

      {/* Drag target highlight */}
      {isDragOver && (
        <div className="absolute inset-0 border-2 border-dashed border-ag-accent bg-ag-accent/15 pointer-events-none z-20 flex items-center justify-center">
          <span className="text-[10px] font-semibold text-ag-accent bg-ag-surface-1/90 px-2 py-1 rounded-full">
            Soltar aqui
          </span>
        </div>
      )}

      {/* Quick actions — visible when selected */}
      {isSelected && (
        <div
          className="absolute top-1.5 right-1.5 z-30 flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {hasImage && (
            <>
              <IconButton label="Ampliar" size="sm" variant="surface" onClick={onZoom}>
                <ZoomIn className="h-3 w-3" />
              </IconButton>
              <IconButton label="Trocar posição" size="sm" variant="surface" onClick={onStartSwap}>
                <span className="text-[9px] font-bold">⇄</span>
              </IconButton>
              <IconButton label="Remover foto" size="sm" variant="danger" onClick={onRemove}>
                <X className="h-3 w-3" />
              </IconButton>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
          <IconButton
            label="Enviar imagem"
            size="sm"
            variant="accent"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3 w-3" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
