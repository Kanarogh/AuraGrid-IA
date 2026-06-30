import { useState, type DragEvent } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { CanvaGridPage } from "../../types";
import { isCanvaSlotFilled } from "../../lib/canva";
import { cn } from "../../lib/cn";
import { IconButton } from "../ui/IconButton";

const PAGE_DRAG_MIME = "application/x-aurastudio-canva-page";

export function CanvaPageStrip({
  pages,
  activePageId,
  cloudSave,
  onSelectPage,
  onAddPage,
  onDeletePage,
  onReorderPages,
}: {
  pages: CanvaGridPage[];
  activePageId: string;
  cloudSave?: boolean;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
  onReorderPages: (fromIndex: number, toIndex: number) => void;
}) {
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleDragStart = (e: DragEvent, index: number) => {
    setDragFromIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(PAGE_DRAG_MIME, String(index));
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragFromIndex !== null && dragFromIndex !== index) {
      setDropTargetIndex(index);
    }
  };

  const handleDrop = (e: DragEvent, toIndex: number) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(PAGE_DRAG_MIME);
    const fromIndex = raw !== "" ? parseInt(raw, 10) : dragFromIndex;
    if (fromIndex !== null && !Number.isNaN(fromIndex) && fromIndex !== toIndex) {
      onReorderPages(fromIndex, toIndex);
    }
    setDragFromIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDragFromIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-ag-muted">
            Páginas do grid
          </p>
          <p className="text-[9px] text-ag-muted/80 mt-0.5">
            {cloudSave
              ? "Salvo na nuvem do cliente ativo"
              : "Salvo automaticamente no cliente ativo"}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddPage}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ag-accent hover:text-ag-accent-strong transition-colors cursor-pointer ag-focus-ring rounded-lg px-2 py-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova página
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 ag-scrollbar-thin">
        {pages.map((page, pageIndex) => {
          const isActive = page.id === activePageId;
          const filled = (page.slots ?? []).filter(isCanvaSlotFilled).length;
          const isDragging = dragFromIndex === pageIndex;
          const isDropTarget = dropTargetIndex === pageIndex;

          return (
            <div
              key={page.id}
              className={cn(
                "group relative flex-shrink-0 w-[108px] transition-opacity",
                isDragging && "opacity-40"
              )}
              onDragOver={(e) => handleDragOver(e, pageIndex)}
              onDragLeave={() => setDropTargetIndex(null)}
              onDrop={(e) => handleDrop(e, pageIndex)}
            >
              {isDropTarget && (
                <div className="absolute -left-1 top-1 bottom-1 w-0.5 rounded-full bg-ag-accent z-20" />
              )}
              <button
                type="button"
                onClick={() => onSelectPage(page.id)}
                className={cn(
                  "w-full rounded-xl border p-2.5 text-left transition-all cursor-pointer ag-focus-ring",
                  isActive
                    ? "border-ag-accent bg-ag-accent-soft shadow-[var(--ag-shadow)]"
                    : "border-ag-border bg-ag-surface-1 hover:border-ag-accent/40 hover:bg-ag-surface-2",
                  isDropTarget && !isActive && "border-ag-accent/60 ring-1 ring-ag-accent/30"
                )}
              >
                <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-ag-surface-3 p-1 mb-2">
                  {(page.slots ?? []).map((s, i) => (
                    <div
                      key={s?.id ?? i}
                      className={cn(
                        "h-1 rounded-[2px]",
                        isCanvaSlotFilled(s) ? "bg-ag-accent" : "bg-ag-muted/25"
                      )}
                    />
                  ))}
                </div>
                <p className="text-[11px] font-semibold text-ag-text truncate font-display">{page.name}</p>
                <p className="text-[9px] text-ag-muted mt-0.5">{filled}/12 itens</p>
              </button>

              <button
                type="button"
                draggable
                aria-label={`Reordenar ${page.name}`}
                onDragStart={(e) => handleDragStart(e, pageIndex)}
                onDragEnd={handleDragEnd}
                className="absolute top-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-ag-surface-1/90 border border-ag-border text-ag-muted opacity-0 group-hover:opacity-100 hover:text-ag-accent hover:border-ag-accent/40 cursor-grab active:cursor-grabbing transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-3 w-3" />
              </button>

              {pages.length > 1 && (
                <IconButton
                  label="Excluir página"
                  size="sm"
                  variant="danger"
                  className="absolute -top-1.5 -right-1.5 z-10 !p-1 h-5 w-5 rounded-full bg-ag-danger text-ag-accent-fg hover:bg-ag-danger/90 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onDeletePage(page.id)}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </IconButton>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
