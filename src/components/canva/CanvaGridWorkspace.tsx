"use client";

import { useRef, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  Copy,
  Info,
  LayoutGrid,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import type { CanvaGridPage, CanvaGridSlot as CanvaSlot, CatalogItem } from "../../types";
import type { CanvaGridFormat } from "../../lib/canvaGridFormats";
import { isCanvaSlotFilled, resolveCanvaPageNumber, type CanvaCatalogPlacement } from "../../lib/canva";
import { cn } from "../../lib/cn";
import { useCanvaWardrobePanelWidth } from "../../hooks/useCanvaWardrobePanelWidth";
import { WorkspaceCard, WorkspaceCardHeader } from "../layout/WorkspaceCard";
import { Button } from "../ui/Button";
import { CanvaGridCanvasToolbar } from "./CanvaGridCanvasToolbar";
import { CanvaGridSlot } from "./CanvaGridSlot";
import { CanvaGridSplitHandle } from "./CanvaGridSplitHandle";
import { CanvaPageStrip } from "./CanvaPageStrip";
import { CanvaWardrobePanel } from "./CanvaWardrobePanel";
import type { CanvaGridFormatId } from "../../lib/canvaGridFormats";

const WORKFLOW_STEPS = [
  { n: 1, label: "Selecione um slot no grid" },
  { n: 2, label: "Arraste um item ou envie uma imagem" },
  { n: 3, label: "Use ⇄ para trocar a posição com outro slot" },
] as const;

export function CanvaGridWorkspace({
  pages,
  activePage,
  activePageId,
  selectedSlotId,
  selectedSlotNumber,
  canvaSlotDragOver,
  canvaGridFormat,
  canvaGridFormatMeta,
  canvaGridMaxWidth,
  wardrobeItems,
  catalogUsageAcrossPages,
  onSelectPage,
  onAddPage,
  onDeletePage,
  onDuplicatePage,
  onClearPage,
  onReorderPages,
  onBatchUpload,
  onSelectSlot,
  onClearSlotSelection,
  onSwapSlots,
  onClearSlotImage,
  onUploadSlot,
  onDropOnSlot,
  onSlotDragOver,
  onSlotDragLeave,
  onOpenLightbox,
  onFormatChange,
  onZoomChange,
  onAssignWardrobeItem,
  onOpenCatalog,
  cloudSave,
}: {
  pages: CanvaGridPage[];
  activePage: CanvaGridPage;
  activePageId: string;
  selectedSlotId: string | null;
  selectedSlotNumber: number | null;
  canvaSlotDragOver: string | null;
  canvaGridFormat: CanvaGridFormatId;
  canvaGridFormatMeta: CanvaGridFormat;
  canvaGridMaxWidth: number;
  wardrobeItems: CatalogItem[];
  catalogUsageAcrossPages: Map<string, CanvaCatalogPlacement[]>;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  onClearPage: (pageId: string) => void;
  onReorderPages: (fromIndex: number, toIndex: number) => void;
  onBatchUpload: (files: FileList) => void;
  onSelectSlot: (slotId: string) => void;
  onClearSlotSelection: () => void;
  onSwapSlots: (slotIdA: string, slotIdB: string) => void;
  onClearSlotImage: (slotId: string) => void;
  onUploadSlot: (slotId: string, file: File) => void;
  onDropOnSlot: (slotId: string, dataTransfer: DataTransfer) => void;
  onSlotDragOver: (slotId: string) => void;
  onSlotDragLeave: (slotId: string) => void;
  onOpenLightbox: (slot: CanvaSlot, slotNumber: number) => void;
  onFormatChange: (format: CanvaGridFormatId) => void;
  onZoomChange: (width: number) => void;
  onAssignWardrobeItem: (item: CatalogItem) => void;
  onOpenCatalog?: () => void;
  cloudSave?: boolean;
}) {
  const [tipsOpen, setTipsOpen] = useState(false);
  const {
    splitRef,
    panelWidthPct,
    isResizing,
    startResize,
    nudgePanelWidth,
    wardrobePanelStyle,
  } = useCanvaWardrobePanelWidth();
  const [swapSourceSlotId, setSwapSourceSlotId] = useState<string | null>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const filledCount = (activePage.slots ?? []).filter(isCanvaSlotFilled).length;

  const clearSelection = () => {
    setSwapSourceSlotId(null);
    onClearSlotSelection();
  };

  const handleSlotClick = (slotId: string) => {
    if (swapSourceSlotId) {
      if (swapSourceSlotId === slotId) {
        setSwapSourceSlotId(null);
        return;
      }
      onSwapSlots(swapSourceSlotId, slotId);
      setSwapSourceSlotId(null);
      onSelectSlot(slotId);
      return;
    }

    if (selectedSlotId === slotId) {
      clearSelection();
    } else {
      onSelectSlot(slotId);
    }
  };

  const handleStartSwap = (slotId: string) => {
    setSwapSourceSlotId(slotId);
    onSelectSlot(slotId);
  };

  const handleSelectPage = (pageId: string) => {
    setSwapSourceSlotId(null);
    onSelectPage(pageId);
  };

  return (
    <div className="space-y-5">
      <WorkspaceCard variant="secondary" padding>
        <WorkspaceCardHeader
          title="Como montar o grid"
          subtitle="Selecione um slot, arraste do guarda-roupa ou troque posições entre slots."
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {WORKFLOW_STEPS.map((step) => (
          <div
            key={step.n}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs",
              step.n === 1 && selectedSlotId
                ? "border-ag-accent/40 bg-ag-accent-soft text-ag-text"
                : step.n === 2 && selectedSlotId
                  ? "border-ag-accent/40 bg-ag-accent-soft text-ag-text"
                  :               step.n === 3 && swapSourceSlotId
                    ? "border-ag-accent/40 bg-ag-accent-soft text-ag-text"
                    : "border-ag-border bg-ag-surface-2/60 text-ag-muted"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold font-mono",
                (selectedSlotId && step.n <= 2) || (swapSourceSlotId && step.n === 3)
                  ? "bg-ag-accent text-ag-accent-fg"
                  : "bg-ag-surface-3 text-ag-muted"
              )}
            >
              {step.n}
            </span>
            <span className="leading-snug">{step.label}</span>
          </div>
        ))}
        </div>
      </WorkspaceCard>

      <div
        ref={splitRef}
        className={cn(
          "flex flex-col gap-5 xl:flex-row xl:gap-0 xl:items-start",
          isResizing && "select-none"
        )}
      >
        {/* Main canvas column */}
        <div className="@container/canva-main flex-1 min-w-0 space-y-4 w-full">
          <CanvaPageStrip
            pages={pages}
            activePageId={activePageId}
            cloudSave={cloudSave}
            onSelectPage={handleSelectPage}
            onAddPage={onAddPage}
            onDeletePage={onDeletePage}
            onReorderPages={onReorderPages}
          />

          {/* Page toolbar */}
          <div className="ag-card p-4 space-y-3 @container/canva-toolbar">
            <div className="min-w-0 border-b border-ag-border/50 pb-3">
              <div className="flex items-start gap-2.5">
                <LayoutGrid className="h-4 w-4 text-ag-accent shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base @lg/canva-toolbar:text-lg font-semibold text-ag-text tracking-tight leading-snug">
                    {activePage.name}
                  </h3>
                  <p className="text-xs text-ag-muted mt-0.5">
                    {filledCount} de 12 slots preenchidos · {canvaGridFormatMeta.ratioLabel} (
                    {canvaGridFormatMeta.dimensions}px)
                  </p>
                  {cloudSave && (
                    <p className="text-[10.5px] text-ag-muted mt-1.5 leading-relaxed">
                      Cada foto no grid é salva na nuvem ao ser colocada. O catálogo é um acervo
                      separado — arraste itens para os slots para montar o feed.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 @xl/canva-toolbar:grid-cols-4 gap-2">
              <input
                ref={batchInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) onBatchUpload(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                variant="accent"
                size="sm"
                className="w-full justify-center"
                onClick={() => batchInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Lote 1–12</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                onClick={() => onDuplicatePage(activePage.id)}
              >
                <Copy className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Duplicar</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                onClick={() => onClearPage(activePage.id)}
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Limpar</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="w-full justify-center"
                onClick={() => onDeletePage(activePage.id)}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Excluir</span>
              </Button>
            </div>

            {swapSourceSlotId && (
              <p className="text-xs text-ag-accent font-medium flex items-center justify-between gap-2 rounded-lg border border-ag-accent/30 bg-ag-accent-soft px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                  Modo troca: clique no slot de destino para inverter as posições.
                </span>
                <button
                  type="button"
                  onClick={() => setSwapSourceSlotId(null)}
                  className="text-[10px] font-semibold text-ag-muted hover:text-ag-text shrink-0 cursor-pointer"
                >
                  Cancelar troca
                </button>
              </p>
            )}

            <CanvaGridCanvasToolbar
              format={canvaGridFormat}
              formatMeta={canvaGridFormatMeta}
              maxWidth={canvaGridMaxWidth}
              onFormatChange={onFormatChange}
              onZoomChange={onZoomChange}
            />

            {/* Grid */}
            <div
              className={cn(
                "mx-auto overflow-hidden rounded-xl border border-ag-border bg-ag-surface-3 shadow-[var(--ag-shadow)] transition-[width] duration-200",
                canvaGridFormat === "stories" && "max-h-[min(80vh,1100px)] overflow-y-auto ag-scrollbar-thin"
              )}
              style={{ width: canvaGridMaxWidth, maxWidth: "100%" }}
            >
              <div className="grid grid-cols-3 gap-px bg-ag-border p-px">
                {(activePage.slots ?? []).map((slot, index) => {
                  if (!slot) return null;
                  const slotNumber = index + 1;
                  return (
                    <div
                      key={slot.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                        onSlotDragOver(slot.id);
                      }}
                      onDragLeave={() => onSlotDragLeave(slot.id)}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void onDropOnSlot(slot.id, e.dataTransfer);
                      }}
                    >
                      <CanvaGridSlot
                        slot={slot}
                        slotNumber={slotNumber}
                        aspectRatio={canvaGridFormatMeta.aspectRatio}
                        isSelected={selectedSlotId === slot.id}
                        isDragOver={canvaSlotDragOver === slot.id}
                        isSwapMode={!!swapSourceSlotId && swapSourceSlotId !== slot.id}
                        onSelect={() => handleSlotClick(slot.id)}
                        onDoubleClickImage={() => onOpenLightbox(slot, slotNumber)}
                        onUpload={(file) => onUploadSlot(slot.id, file)}
                        onRemove={() => onClearSlotImage(slot.id)}
                        onZoom={() => onOpenLightbox(slot, slotNumber)}
                        onStartSwap={() => handleStartSwap(slot.id)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-xl border border-ag-border overflow-hidden">
              <button
                type="button"
                onClick={() => setTipsOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left bg-ag-surface-2/30 hover:bg-ag-surface-2/50 transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold text-ag-muted flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  Como importar do Canva
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 text-ag-muted transition-transform", tipsOpen && "rotate-180")}
                />
              </button>
              {tipsOpen && (
                <div className="px-4 pb-4 pt-2 text-xs text-ag-muted leading-relaxed border-t border-ag-border">
                  Exporte PNG no Canva e arraste para o slot, use <strong className="text-ag-text">Lote 1–12</strong>{" "}
                  para sequência automática, ou copie a imagem exportada e use{" "}
                  <strong className="text-ag-text">Ctrl+V</strong> com um slot selecionado. Looks do
                  guarda-roupa podem ser arrastados direto para qualquer espaço.
                </div>
              )}
            </div>
          </div>
        </div>

        <CanvaGridSplitHandle
          isResizing={isResizing}
          panelWidthPct={panelWidthPct}
          onResizeStart={startResize}
          onNudge={nudgePanelWidth}
        />

        {/* Wardrobe sidebar */}
        <div
          className={cn(
            "w-full shrink-0",
            "xl:sticky xl:top-20 xl:self-start xl:flex xl:flex-col xl:h-[calc(100vh-5rem)] xl:max-h-[calc(100vh-5rem)]",
            isResizing && "pointer-events-none"
          )}
          style={wardrobePanelStyle}
        >
          <CanvaWardrobePanel
            items={wardrobeItems}
            usageByCatalogId={catalogUsageAcrossPages}
            activePageNumber={resolveCanvaPageNumber(pages, activePageId)}
            gridAspectRatio={canvaGridFormatMeta.aspectRatio}
            gridRatioLabel={canvaGridFormatMeta.ratioLabel}
            selectedSlotId={selectedSlotId}
            selectedSlotNumber={selectedSlotNumber}
            onClearSlotSelection={clearSelection}
            onAssignItem={onAssignWardrobeItem}
            onOpenCatalog={onOpenCatalog}
          />
        </div>
      </div>
    </div>
  );
}
