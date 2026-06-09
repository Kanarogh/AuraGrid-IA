import { Plus, Trash2 } from "lucide-react";
import type { CanvaGridPage } from "../../types";
import { cn } from "../../lib/cn";
import { IconButton } from "../ui/IconButton";

export function CanvaPageStrip({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onDeletePage,
}: {
  pages: CanvaGridPage[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-ag-muted">
            Páginas do grid
          </p>
          <p className="text-[9px] text-ag-muted/80 mt-0.5">
            Salvo automaticamente no cliente ativo
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
        {pages.map((page) => {
          const isActive = page.id === activePageId;
          const filled = page.slots.filter((s) => s.image).length;

          return (
            <div key={page.id} className="group relative flex-shrink-0 w-[108px]">
              <button
                type="button"
                onClick={() => onSelectPage(page.id)}
                className={cn(
                  "w-full rounded-xl border p-2.5 text-left transition-all cursor-pointer ag-focus-ring",
                  isActive
                    ? "border-ag-accent bg-ag-accent-soft shadow-sm"
                    : "border-ag-border bg-ag-surface-1 hover:border-ag-accent/40 hover:bg-ag-surface-2"
                )}
              >
                <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-ag-surface-3 p-1 mb-2">
                  {page.slots.map((s, i) => (
                    <div
                      key={i}
                      className={cn("h-1 rounded-[2px]", s.image ? "bg-ag-accent" : "bg-ag-muted/25")}
                    />
                  ))}
                </div>
                <p className="text-[11px] font-semibold text-ag-text truncate font-display">{page.name}</p>
                <p className="text-[9px] text-ag-muted mt-0.5">{filled}/12 looks</p>
              </button>

              {pages.length > 1 && (
                <IconButton
                  label="Excluir página"
                  size="sm"
                  variant="danger"
                  className="absolute -top-1.5 -right-1.5 z-10 !p-1 h-5 w-5 rounded-full bg-ag-danger text-white hover:bg-ag-danger/90 opacity-0 group-hover:opacity-100 transition-opacity"
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
