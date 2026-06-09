import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Filter,
  LayoutGrid,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import type { CatalogItem } from "../../types";
import { cn } from "../../lib/cn";
import { CATALOG_DRAG_MIME } from "../../lib/clipboardImage";

type WardrobeFilter = "all" | "available" | "in_grid";

export function CanvaWardrobePanel({
  items,
  usageByCatalogId,
  gridAspectRatio,
  gridRatioLabel,
  selectedSlotId,
  selectedSlotNumber,
  onClearSlotSelection,
  onAssignItem,
}: {
  items: CatalogItem[];
  /** catalogId → números dos slots (L1, L2…) na página ativa */
  usageByCatalogId: Map<string, number[]>;
  gridAspectRatio: number;
  gridRatioLabel: string;
  selectedSlotId: string | null;
  selectedSlotNumber: number | null;
  onClearSlotSelection: () => void;
  onAssignItem: (item: CatalogItem) => void;
}) {
  const [filter, setFilter] = useState<WardrobeFilter>("all");

  const inGridCount = useMemo(() => {
    let n = 0;
    for (const item of items) {
      if ((usageByCatalogId.get(item.id)?.length ?? 0) > 0) n++;
    }
    return n;
  }, [items, usageByCatalogId]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const used = (usageByCatalogId.get(item.id)?.length ?? 0) > 0;
      if (filter === "available") return !used;
      if (filter === "in_grid") return used;
      return true;
    });
  }, [items, usageByCatalogId, filter]);

  const filterBtn = (id: WardrobeFilter, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => setFilter(id)}
      className={cn(
        "text-[9px] font-bold px-2 py-1 rounded-md border transition-colors cursor-pointer",
        filter === id
          ? "bg-ag-accent/15 border-ag-accent/40 text-ag-accent"
          : "border-ag-border text-ag-muted hover:text-ag-text hover:border-ag-border"
      )}
    >
      {label}
      {count != null ? ` (${count})` : ""}
    </button>
  );

  return (
    <div className="w-full lg:w-[min(340px,34%)] shrink-0 flex flex-col rounded-xl border border-ag-border/60 bg-ag-surface-2/50 backdrop-blur-sm overflow-hidden">
      <div className="p-4 border-b border-ag-border/60 bg-ag-surface-1/40">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-display italic text-lg font-bold text-ag-text flex items-center gap-1.5">
              <ShoppingBag className="h-5 w-5 text-ag-accent shrink-0" />
              Guarda-roupa
            </h3>
            <p className="text-[10px] text-ag-muted mt-0.5 leading-relaxed">
              Miniaturas em <strong className="text-ag-text">{gridRatioLabel}</strong> — igual ao
              grid ativo
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold font-mono bg-ag-success/15 text-ag-success border border-ag-success/25 px-2 py-0.5 rounded-full block">
              {inGridCount} no grid
            </span>
            <span className="text-[9px] text-ag-muted mt-1 block">{items.length} total</span>
          </div>
        </div>

        {selectedSlotId && selectedSlotNumber != null ? (
          <div className="bg-ag-accent/12 text-ag-accent border border-ag-accent/25 p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between gap-2">
            <span>
              Espaço <strong>L{selectedSlotNumber}</strong> selecionado — clique em um look abaixo
            </span>
            <button
              type="button"
              onClick={onClearSlotSelection}
              className="text-ag-muted hover:text-ag-text font-bold shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="text-[10px] text-ag-muted leading-relaxed rounded-lg bg-ag-surface-1/80 border border-ag-border/50 px-2.5 py-2">
            Clique em um quadrado do grid, depois escolha o look — ou arraste direto para o slot.
            <span className="block mt-1 text-ag-success">
              <CheckCircle2 className="inline h-3 w-3 mr-0.5 -mt-px" />
              Borda verde = já está nesta página
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <Filter className="h-3 w-3 text-ag-muted shrink-0" />
          {filterBtn("all", "Todos", items.length)}
          {filterBtn("available", "Livres", items.length - inGridCount)}
          {filterBtn("in_grid", "No grid", inGridCount)}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 ag-scrollbar-thin max-h-[min(520px,55vh)]">
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-ag-muted text-xs">
            {filter === "available"
              ? "Todos os looks já estão no grid desta página."
              : filter === "in_grid"
                ? "Nenhum look do acervo nesta página ainda."
                : "Acervo vazio — cadastre na aba Catálogo."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredItems.map((item) => {
              const slotNumbers = usageByCatalogId.get(item.id) ?? [];
              const isInGrid = slotNumbers.length > 0;
              const isGridAsset = item.isReference === false;

              return (
                <button
                  key={item.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(CATALOG_DRAG_MIME, item.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onAssignItem(item)}
                  className={cn(
                    "group text-left border rounded-xl p-1.5 transition-all relative cursor-grab active:cursor-grabbing",
                    "hover:shadow-md hover:border-ag-accent/35",
                    isInGrid
                      ? "bg-ag-success/8 border-ag-success/45 ring-1 ring-ag-success/30"
                      : "bg-ag-surface-1 border-ag-border"
                  )}
                >
                  <div
                    className="rounded-lg overflow-hidden bg-ag-surface-3 relative mb-1.5 w-full"
                    style={{ aspectRatio: gridAspectRatio }}
                  >
                    <img
                      src={item.image ?? undefined}
                      alt={item.label}
                      referrerPolicy="no-referrer"
                      draggable={false}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    />
                    {isInGrid && (
                      <span className="absolute top-1 left-1 flex items-center gap-0.5 text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-md bg-ag-success/95 text-white shadow-sm">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        L{slotNumbers.join(", L")}
                      </span>
                    )}
                    {isGridAsset && !isInGrid && (
                      <span className="absolute top-1 right-1 text-[7px] font-bold px-1 py-0.5 rounded bg-ag-accent/85 text-ag-accent-fg">
                        Grid
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-[9px] font-bold truncate leading-tight uppercase px-0.5",
                      isInGrid ? "text-ag-success" : "text-ag-text"
                    )}
                    title={item.label}
                  >
                    {item.label}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-ag-border/50 bg-ag-surface-1/30 flex items-center gap-1.5 text-[9px] text-ag-muted">
        <LayoutGrid className="h-3 w-3 shrink-0" />
        <span>
          Proporção <strong className="text-ag-text">{gridRatioLabel}</strong>
        </span>
        <span className="text-ag-border">·</span>
        <Sparkles className="h-3 w-3 shrink-0" />
        <span>Arraste ou clique para preencher</span>
      </div>
    </div>
  );
}
