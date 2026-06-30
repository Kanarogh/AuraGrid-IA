import { ArrowLeftRight, Check, Upload, X } from "lucide-react";
import type { CatalogItem, PlannedPost } from "../../types";
import { getPostStatus } from "../../lib/postStatus";
import { getPostDayLabel } from "../../lib/postDisplay";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";

export function TimelineStrip({
  posts,
  catalog,
  activePreviewId,
  swapSourceId,
  reorderMode = false,
  onSelectPost,
  onSwapClick,
  onEnterReorderMode,
  onCancelReorder,
}: {
  posts: PlannedPost[];
  catalog: CatalogItem[];
  activePreviewId: string;
  swapSourceId: string;
  reorderMode?: boolean;
  onSelectPost: (id: string) => void;
  onSwapClick: (id: string) => void;
  onEnterReorderMode?: () => void;
  onCancelReorder?: () => void;
}) {
  return (
    <div className="mb-4 ag-studio relative overflow-hidden rounded-xl border border-ag-border/70 p-4 sm:p-5 shadow-[var(--ag-shadow)] animate-ag-fade-in">
      <div className="ag-studio-mesh absolute inset-0 pointer-events-none opacity-60" aria-hidden />
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ag-accent">
              Linha editorial — 30 dias
            </h2>
            <p className="text-xs text-ag-muted mt-0.5">
              {reorderMode
                ? "Toque em outro dia para trocar o conteúdo com a origem selecionada."
                : "Selecione um dia para editar legenda e referências."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reorderMode ? (
              <>
                <span className="text-[10px] font-mono text-ag-accent uppercase tracking-wider">
                  Modo reordenar
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={onCancelReorder}>
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </Button>
              </>
            ) : (
              onEnterReorderMode && (
                <Button type="button" variant="secondary" size="sm" onClick={onEnterReorderMode}>
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Reordenar dias
                </Button>
              )
            )}
            <div className="flex flex-wrap gap-3 text-[10px] font-mono text-ag-muted">
              <Legend dotClass="bg-ag-muted" label="Sem foto" />
              <Legend dotClass="bg-ag-accent" label="Rascunho" />
              <Legend dotClass="bg-ag-warning" label="Revisão" />
              <Legend dotClass="bg-ag-success" label="Aprovado" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 ag-scrollbar-thin snap-x">
          {posts.map((post) => {
            const status = getPostStatus(post);
            const isActive = post.id === activePreviewId;
            const isSwapSource = swapSourceId === post.id;

            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post.id)}
                className={cn(
                  "rounded-xl p-3 border text-center cursor-pointer transition-all duration-200 relative group flex flex-col min-w-[170px] sm:min-w-[190px] shrink-0 snap-start",
                  isSwapSource && "ring-2 ring-ag-danger border-ag-danger bg-ag-danger/5",
                  isActive && !isSwapSource
                    ? "border-ag-accent ring-2 ring-ag-accent/20 bg-ag-accent-soft shadow-[var(--ag-shadow)]"
                    : !isSwapSource &&
                        (post.isConfirmed
                          ? "border-ag-success/35 bg-ag-success/5 hover:border-ag-success"
                          : "border-ag-border bg-ag-surface-2 hover:border-ag-accent/40 hover:bg-ag-surface-1")
                )}
              >
                {isSwapSource && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 text-[9px] font-bold uppercase tracking-wider bg-ag-danger text-ag-danger-fg px-2 py-0.5 rounded-full">
                    Origem
                  </span>
                )}

                <div className="flex items-center justify-between mb-2 px-0.5">
                  <div className="text-left">
                    <span
                      className={cn(
                        "text-xs font-display font-semibold block",
                        isActive ? "text-ag-accent" : "text-ag-text"
                      )}
                    >
                      {getPostDayLabel(post, posts)}
                    </span>
                    <span className="text-[9px] text-ag-muted block">{post.dateLabel}</span>
                  </div>
                  {post.isConfirmed ? (
                    <span className="bg-ag-success text-ag-success-fg p-0.5 rounded-full">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : post.caption ? (
                    <span className="h-2 w-2 rounded-full bg-ag-accent" />
                  ) : null}
                </div>

                <div className="h-28 w-full rounded-xl border border-ag-border bg-ag-bg flex items-center justify-center overflow-hidden">
                  {post.image ? (
                    <img
                      src={post.image}
                      alt={`Dia ${post.dayNumber}`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-ag-muted flex flex-col items-center">
                      <Upload className="h-4 w-4 mb-1 opacity-60" />
                      <span className="text-[8px] uppercase font-mono">Vazio</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 space-y-1">
                  <span
                    className={cn(
                      "text-[8px] font-mono px-2 py-0.5 rounded-full border inline-block",
                      status.badge
                    )}
                  >
                    {status.label}
                  </span>
                  {post.matchedCatalogId ? (
                    <div className="text-[9px] font-mono text-ag-accent truncate w-full px-1">
                      {catalog.find((c) => c.id === post.matchedCatalogId)?.label ||
                        post.matchedCatalogId}
                    </div>
                  ) : (
                    <span className="text-[9px] text-ag-muted italic">Sem ref.</span>
                  )}
                </div>

                <div
                  className={cn(
                    "absolute inset-0 bg-ag-surface-1/95 flex flex-col justify-center items-center gap-1.5 p-2 rounded-xl border border-ag-accent/20 transition-opacity",
                    reorderMode
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
                  )}
                >
                  {!reorderMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPost(post.id);
                      }}
                      className="w-full bg-ag-accent text-ag-accent-fg text-[10px] font-bold py-1.5 rounded-lg"
                    >
                      Editar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwapClick(post.id);
                    }}
                    className={cn(
                      "w-full text-[9px] font-semibold py-1.5 rounded-lg border",
                      isSwapSource
                        ? "bg-ag-danger text-ag-danger-fg border-ag-danger"
                        : "bg-ag-surface-2 border-ag-border text-ag-text"
                    )}
                  >
                    {isSwapSource ? "Cancelar origem" : reorderMode ? "Trocar com este" : "Reordenar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Legend({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
      {label}
    </span>
  );
}
