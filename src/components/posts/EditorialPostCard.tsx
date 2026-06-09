import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Eraser,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import type { CatalogItem, PlannedPost } from "../../types";
import type { PostStatusStyle } from "../../lib/postStatus";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { AiErrorBanner } from "../shared/AiErrorBanner";

export function EditorialPostCard({
  post,
  status,
  isFocused,
  referenceCatalog,
  postDragOver,
  copiedId,
  refineInstruction,
  isRefining,
  brandGemReady = true,
  onAddPostToDay,
  onRemove,
  onToggleConfirm,
  onCopyCaption,
  onPhotoUpload,
  onClearImage,
  onSelectReference,
  onToggleCaptionFromImageOnly,
  onGenerate,
  onStopGenerate,
  onCaptionChange,
  onClearCaption,
  onRefineInstructionChange,
  onRefine,
  onFocus,
}: {
  post: PlannedPost;
  status: PostStatusStyle;
  isFocused: boolean;
  referenceCatalog: CatalogItem[];
  postDragOver: boolean;
  copiedId: string | null;
  refineInstruction: string;
  isRefining: boolean;
  brandGemReady?: boolean;
  onAddPostToDay: () => void;
  onRemove: () => void;
  onToggleConfirm: () => void;
  onCopyCaption: () => void;
  onPhotoUpload: (file: File) => void;
  onClearImage: () => void;
  onSelectReference: (id: string | null) => void;
  onToggleCaptionFromImageOnly: (enabled: boolean) => void;
  onGenerate: () => void;
  onStopGenerate: () => void;
  onCaptionChange: (v: string) => void;
  onClearCaption: () => void;
  onRefineInstructionChange: (v: string) => void;
  onRefine: (instruction?: string) => void;
  onFocus: () => void;
}) {
  const inputId = `editorial-file-${post.id}`;

  return (
    <article
      id={`editorial-row-${post.id}`}
      onClick={onFocus}
      className={cn(
        "rounded-xl border transition-all duration-200 bg-ag-surface-1 overflow-hidden shadow-sm",
        isFocused ? "border-ag-accent ring-2 ring-ag-accent/20" : "border-ag-border",
        post.isConfirmed && "border-ag-success/40"
      )}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-ag-border bg-ag-surface-2/80">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display text-2xl font-semibold text-ag-accent leading-none tabular-nums">
            {post.dayNumber}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ag-text">{post.dateLabel}</p>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide mt-1 px-2 py-0.5 rounded-full border",
                status.badge
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", status.dot)} />
              {status.label}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 ml-auto" onClick={(e) => e.stopPropagation()}>
          <Button type="button" variant="ghost" size="sm" onClick={onAddPostToDay} title="Novo post neste dia">
            <Plus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} title="Remover">
            <Trash2 className="h-4 w-4 text-ag-danger" />
          </Button>
          {post.caption && (
            <Button type="button" variant="ghost" size="sm" onClick={onCopyCaption} title="Copiar">
              {copiedId === post.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          )}
          <Button
            type="button"
            variant={post.isConfirmed ? "primary" : "secondary"}
            size="sm"
            onClick={onToggleConfirm}
            disabled={!post.caption}
          >
            <CheckCircle2 className="h-4 w-4" />
            {post.isConfirmed ? "Aprovado" : "Aprovar"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-start">
        <div
          className="p-4 md:w-56 shrink-0 md:border-r border-ag-border bg-ag-surface-2/30 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-ag-muted">Foto do feed</p>
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) await onPhotoUpload(file);
            }}
            onClick={() => document.getElementById(inputId)?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") document.getElementById(inputId)?.click();
            }}
            className={cn(
              "relative w-full aspect-[4/5] max-h-[280px] rounded-lg overflow-hidden cursor-pointer border-2 border-dashed transition-colors",
              post.image ? "border-transparent bg-ag-surface-3" : "border-ag-border hover:border-ag-accent/50",
              postDragOver && "border-ag-accent bg-ag-accent/5"
            )}
          >
            {post.image ? (
              <>
                <img
                  src={post.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/55 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-xs">
                  <Upload className="h-4 w-4" />
                  Substituir
                  <button
                    type="button"
                    className="mt-2 text-[10px] underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearImage();
                    }}
                  >
                    Remover
                  </button>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-ag-muted p-4 text-center">
                <Upload className="h-6 w-6 mb-2 text-ag-accent/70" />
                <span className="text-xs font-medium text-ag-text">Carregar foto</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              id={inputId}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await onPhotoUpload(file);
              }}
            />
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-ag-border/70 bg-ag-surface-2/60 px-2.5 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!post.captionFromImageOnly}
              onChange={(e) => {
                e.stopPropagation();
                onToggleCaptionFromImageOnly(e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-ag-border text-ag-accent"
            />
            <span className="min-w-0 text-[11px] leading-snug text-ag-muted">
              <span className="font-medium text-ag-text block">Legenda pela imagem</span>
              Sem catálogo — para artes e banners com texto
            </span>
          </label>

          <select
            value={post.matchedCatalogId || ""}
            onChange={(e) => onSelectReference(e.target.value || null)}
            disabled={!!post.captionFromImageOnly}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full text-sm rounded-lg px-3 py-2 border border-ag-border bg-ag-surface-1 text-ag-text outline-none focus:border-ag-accent",
              post.captionFromImageOnly && "opacity-50 cursor-not-allowed"
            )}
            title={
              post.captionFromImageOnly
                ? "Desativado — modo legenda pela imagem"
                : undefined
            }
          >
            <option value="">Referência do catálogo…</option>
            {referenceCatalog.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant={post.isGenerating ? "secondary" : "accent"}
            size="sm"
            className={cn(
              "w-full",
              post.isGenerating && "text-ag-danger border-ag-danger/30 hover:bg-ag-danger/10"
            )}
            onClick={post.isGenerating ? onStopGenerate : onGenerate}
            disabled={!post.image || !brandGemReady}
            title={
              !brandGemReady
                ? "Configure o Gem da marca em Configurações"
                : !post.image
                  ? "Carregue a foto do post"
                  : undefined
            }
          >
            {post.isGenerating ? (
              <>
                <Square className="h-4 w-4 fill-current" />
                Parar
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {post.isGenerated ? "Regenerar legenda" : "Gerar legenda"}
              </>
            )}
          </Button>
        </div>

        <div className="flex-1 min-w-0 p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
          {post.reasoning && (
            <details className="rounded-lg border border-ag-border bg-ag-surface-2 text-sm">
              <summary className="px-3 py-2 cursor-pointer font-medium text-ag-text list-none flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-ag-accent shrink-0" />
                Análise da IA
              </summary>
              <p className="px-3 pb-3 text-ag-muted text-xs leading-relaxed">{post.reasoning}</p>
            </details>
          )}

          {post.error && (
            <AiErrorBanner message={post.error} onRetry={() => onGenerate()} compact />
          )}

          <div className="flex flex-col flex-1 min-h-[180px]">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-ag-muted">
                Legenda
              </label>
              {(post.caption || post.isGenerated || post.reasoning) && (
                <button
                  type="button"
                  onClick={onClearCaption}
                  className="text-[10px] font-medium text-ag-muted hover:text-ag-danger flex items-center gap-1 cursor-pointer"
                  title="Apagar legenda e recomeçar do zero"
                >
                  <Eraser className="h-3 w-3" />
                  Remover legenda
                </button>
              )}
            </div>
            <textarea
              value={post.caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              rows={8}
              className="w-full min-h-[180px] text-sm leading-relaxed rounded-xl px-3 py-2.5 border border-ag-border bg-ag-surface-1 text-ag-text outline-none resize-y focus:border-ag-accent focus:ring-2 focus:ring-ag-accent/15 placeholder:text-ag-muted"
              placeholder="Legenda (gere com IA após configurar o Gem, ou escreva aqui)…"
            />
          </div>

          {post.caption && (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={refineInstruction}
                onChange={(e) => onRefineInstructionChange(e.target.value)}
                placeholder="Refinar: ex. mais curto, mais hashtags…"
                className="flex-1 text-sm rounded-lg px-3 py-2 border border-ag-border bg-ag-surface-1 text-ag-text outline-none focus:border-ag-accent"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onRefine(e.currentTarget.value);
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onRefine(refineInstruction)}
                disabled={isRefining || !refineInstruction.trim() || post.isGenerating}
              >
                {isRefining ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Refinar"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
