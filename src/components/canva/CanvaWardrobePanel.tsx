import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, GripVertical, LayoutGrid, ShoppingBag, Sparkles, ZoomIn, ZoomOut } from "lucide-react";
import type { CatalogItem } from "../../types";
import { formatCanvaPlacement, type CanvaCatalogPlacement } from "../../lib/canva";
import { cn } from "../../lib/cn";
import { CATALOG_DRAG_MIME } from "../../lib/clipboardImage";
import { CatalogThumbnail } from "../ui/CatalogThumbnail";
import { EmptyState } from "../ui/EmptyState";
import { IconButton } from "../ui/IconButton";
import { SegmentedControl } from "../ui/SegmentedControl";

type WardrobeFilter = "all" | "available" | "in_grid";

const WARDROBE_THUMB_STORAGE_KEY = "ag_wardrobe_thumb_min";
const WARDROBE_THUMB_MIN = 96;
const WARDROBE_THUMB_MAX = 400;
const WARDROBE_THUMB_DEFAULT = 160;
const WARDROBE_THUMB_STEP = 8;

function readStoredThumbMin(): number {
  if (typeof window === "undefined") return WARDROBE_THUMB_DEFAULT;
  const raw = localStorage.getItem(WARDROBE_THUMB_STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return WARDROBE_THUMB_DEFAULT;
  return Math.min(WARDROBE_THUMB_MAX, Math.max(WARDROBE_THUMB_MIN, n));
}

function clampThumbMin(value: number): number {
  return Math.min(WARDROBE_THUMB_MAX, Math.max(WARDROBE_THUMB_MIN, value));
}

export function CanvaWardrobePanel({
  items,
  usageByCatalogId,
  activePageNumber,
  gridAspectRatio,
  gridRatioLabel,
  selectedSlotId,
  selectedSlotNumber,
  onClearSlotSelection,
  onAssignItem,
  onOpenCatalog,
}: {
  items: CatalogItem[];
  usageByCatalogId: Map<string, CanvaCatalogPlacement[]>;
  activePageNumber: number;
  gridAspectRatio: number;
  gridRatioLabel: string;
  selectedSlotId: string | null;
  selectedSlotNumber: number | null;
  onClearSlotSelection: () => void;
  onAssignItem: (item: CatalogItem) => void;
  onOpenCatalog?: () => void;
}) {
  const [filter, setFilter] = useState<WardrobeFilter>("all");
  const [thumbMinWidth, setThumbMinWidth] = useState(WARDROBE_THUMB_DEFAULT);

  useEffect(() => {
    setThumbMinWidth(readStoredThumbMin());
  }, []);

  const updateThumbMin = (value: number) => {
    const next = clampThumbMin(value);
    setThumbMinWidth(next);
    localStorage.setItem(WARDROBE_THUMB_STORAGE_KEY, String(next));
  };

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

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-1 flex-col rounded-xl border border-ag-border bg-ag-surface-1 shadow-[var(--ag-shadow)] overflow-hidden"
      )}
    >
      <div className="shrink-0 p-4 border-b border-ag-border bg-ag-surface-2/40 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ag-accent-soft text-ag-accent">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold text-ag-text tracking-tight">
              Catálogo
            </h3>
            <p className="text-[11px] text-ag-muted mt-0.5">
              Arraste itens para o grid · {items.length} itens · {gridRatioLabel}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-mono font-semibold text-ag-success bg-ag-success/10 border border-ag-success/25 px-2 py-0.5 rounded-full">
              {inGridCount} no grid
            </span>
          </div>
        </div>

        {selectedSlotId && selectedSlotNumber != null ? (
          <div className="rounded-xl border border-ag-accent/30 bg-ag-accent-soft px-3 py-2.5 flex items-start justify-between gap-2">
            <p className="text-xs text-ag-text leading-relaxed">
              Preenchendo o slot{" "}
              <strong className="font-mono text-ag-accent">L{selectedSlotNumber}</strong> — clique
              em um item ou arraste para o grid.
            </p>
            <button
              type="button"
              onClick={onClearSlotSelection}
              className="text-[10px] font-semibold text-ag-muted hover:text-ag-text shrink-0 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-ag-muted leading-relaxed rounded-xl bg-ag-surface-2 border border-ag-border px-3 py-2">
            Selecione um slot à esquerda, depois escolha o item aqui.{" "}
            <span className="text-ag-success inline-flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" />
              verde = já usado no grid (Pág·slot, ex.: P4L11)
            </span>
          </p>
        )}

        <SegmentedControl
          value={filter}
          onChange={setFilter}
          size="sm"
          className="w-full justify-between"
          options={[
            { id: "all", label: `Todos (${items.length})` },
            { id: "available", label: `Livres (${items.length - inGridCount})` },
            { id: "in_grid", label: `No grid (${inGridCount})` },
          ]}
        />

        <div className="rounded-xl border border-ag-border bg-ag-surface-1/60 px-2.5 py-2 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-ag-muted shrink-0 w-14">
              Tamanho
            </span>
            <IconButton
              label="Diminuir miniaturas"
              variant="surface"
              size="sm"
              onClick={() => updateThumbMin(thumbMinWidth - WARDROBE_THUMB_STEP * 2)}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </IconButton>
            <input
              type="range"
              min={WARDROBE_THUMB_MIN}
              max={WARDROBE_THUMB_MAX}
              step={WARDROBE_THUMB_STEP}
              value={thumbMinWidth}
              onChange={(e) => updateThumbMin(Number(e.target.value))}
              className="flex-1 min-w-0 accent-ag-accent"
              aria-label="Tamanho das miniaturas do guarda-roupa"
            />
            <span className="text-[10px] font-mono text-ag-muted w-9 text-right tabular-nums shrink-0">
              {thumbMinWidth}px
            </span>
            <IconButton
              label="Aumentar miniaturas"
              variant="surface"
              size="sm"
              onClick={() => updateThumbMin(thumbMinWidth + WARDROBE_THUMB_STEP * 2)}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </IconButton>
          </div>
          <p className="hidden xl:flex items-center gap-1.5 text-[10px] text-ag-muted leading-snug">
            <GripVertical className="h-3 w-3 shrink-0 text-ag-accent/70" />
            Arraste a divisória à esquerda para ajustar a largura do painel.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-3 ag-scrollbar-thin">
        {filteredItems.length === 0 ? (
          <EmptyState
            compact
            icon={ShoppingBag}
            title={
              filter === "available"
                ? "Todos os itens já estão no grid"
                : filter === "in_grid"
                  ? "Nenhum item no grid"
                  : "Acervo vazio"
            }
            description={
              filter === "all"
                ? "Cadastre referências no Catálogo para montar o grid."
                : undefined
            }
            action={
              filter === "all" && onOpenCatalog ? (
                <button
                  type="button"
                  onClick={onOpenCatalog}
                  className="text-xs font-semibold text-ag-accent hover:underline cursor-pointer mt-2"
                >
                  Abrir Catálogo →
                </button>
              ) : undefined
            }
          />
        ) : (
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${thumbMinWidth}px, 1fr))`,
            }}
          >
            {filteredItems.map((item) => {
              const placements = usageByCatalogId.get(item.id) ?? [];
              const isInGrid = placements.length > 0;
              const isGridAsset = item.isReference === false;
              const onActivePage = placements.some((p) => p.pageNumber === activePageNumber);

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
                    "group text-left rounded-xl border p-1.5 transition-all cursor-grab active:cursor-grabbing ag-focus-ring",
                    "hover:shadow-[var(--ag-shadow-lg)] hover:border-ag-accent/40",
                    isInGrid
                      ? onActivePage
                        ? "border-ag-success/40 bg-ag-success/5 ring-1 ring-ag-success/20"
                        : "border-ag-border bg-ag-surface-2 ring-1 ring-ag-muted/30"
                      : "border-ag-border bg-ag-surface-2 hover:bg-ag-surface-1"
                  )}
                >
                  <div
                    className="rounded-lg overflow-hidden bg-ag-surface-3 relative mb-1.5 w-full"
                    style={{ aspectRatio: gridAspectRatio }}
                  >
                    <CatalogThumbnail
                      src={item.image}
                      alt={item.label}
                      fallbackLabel={item.label}
                      imgClassName="group-hover:scale-[1.02] transition-transform duration-200"
                    />
                    {isInGrid && (
                      <span className="absolute top-1 left-1 right-1 flex flex-wrap gap-0.5 max-h-[40%] overflow-hidden pointer-events-none">
                        {placements.map((placement) => {
                          const onCurrent = placement.pageNumber === activePageNumber;
                          return (
                            <span
                              key={`${placement.pageNumber}-${placement.slotNumber}`}
                              className={cn(
                                "text-[7px] font-bold font-mono px-1 py-0.5 rounded-md shadow-[var(--ag-shadow)] leading-none",
                                onCurrent
                                  ? "bg-ag-success text-ag-success-fg"
                                  : "bg-ag-surface-1/95 text-ag-muted border border-ag-border"
                              )}
                            >
                              {formatCanvaPlacement(placement)}
                            </span>
                          );
                        })}
                      </span>
                    )}
                    {isGridAsset && !isInGrid && (
                      <span className="absolute top-1 right-1 text-[7px] font-bold px-1 py-0.5 rounded bg-ag-accent/90 text-ag-accent-fg">
                        Grid
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "font-semibold truncate uppercase px-0.5",
                      thumbMinWidth >= 280
                        ? "text-xs"
                        : thumbMinWidth >= 200
                          ? "text-[11px]"
                          : thumbMinWidth >= 150
                            ? "text-[10px]"
                            : "text-[9px]",
                      isInGrid && onActivePage ? "text-ag-success" : "text-ag-text"
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

      <div className="shrink-0 px-3 py-2.5 border-t border-ag-border bg-ag-surface-2/30 flex items-center gap-2 text-[10px] text-ag-muted">
        <LayoutGrid className="h-3 w-3 shrink-0" />
        <span>Arraste para o grid</span>
        <span className="text-ag-border">·</span>
        <Sparkles className="h-3 w-3 shrink-0" />
        <span>ou clique para atribuir</span>
      </div>
    </aside>
  );
}
