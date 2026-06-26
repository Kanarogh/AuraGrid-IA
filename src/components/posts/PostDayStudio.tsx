import type { Ref } from "react";
import {
  Check,
  CheckCheck,
  ChevronLeft,
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
import type { CatalogItem, PlannedPost, RepeatingText } from "../../types";
import type { PostStatusStyle } from "../../lib/postStatus";
import { extractMainCaptionText } from "../../lib/captionFormat";
import { formatGeminiModelIdLabel } from "../../lib/geminiModelDisplay";
import { INSTAGRAM_CAPTION_HARD_MAX } from "../../lib/captionParams";
import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { InstagramPhonePreview } from "./InstagramPhonePreview";
import { AiErrorBanner } from "../shared/AiErrorBanner";

export function PostDayStudio({
  post,
  position,
  total,
  status,
  referenceCatalog,
  postDragOver,
  copiedId,
  refineInstruction,
  isRefining,
  brandGemReady = true,
  captionMaxMainChars = 280,
  captionFooter,
  profileHandle,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onAddPostToDay,
  onRemove,
  onToggleConfirm,
  onPhotoUpload,
  onClearImage,
  onSelectReference,
  onToggleCaptionFromImageOnly,
  onGenerate,
  onStopGenerate,
  onCopyCaption,
  onCaptionChange,
  onClearCaption,
  onRefineInstructionChange,
  onRefine,
  cardRef,
  showReferenceControls = true,
}: {
  post: PlannedPost;
  position: number;
  total: number;
  status: PostStatusStyle;
  referenceCatalog: CatalogItem[];
  postDragOver: boolean;
  copiedId: string | null;
  refineInstruction: string;
  isRefining: boolean;
  brandGemReady?: boolean;
  /** Limite do texto principal (sem rodapé fixo) */
  captionMaxMainChars?: number;
  captionFooter?: RepeatingText;
  profileHandle?: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onAddPostToDay: () => void;
  onRemove: () => void;
  onToggleConfirm: () => void;
  onPhotoUpload: (file: File) => void;
  onClearImage: () => void;
  onSelectReference: (catalogId: string | null) => void;
  onToggleCaptionFromImageOnly: (enabled: boolean) => void;
  onGenerate: () => void;
  onStopGenerate: () => void;
  onCopyCaption: () => void;
  onCaptionChange: (value: string) => void;
  onClearCaption: () => void;
  onRefineInstructionChange: (value: string) => void;
  onRefine: (instruction?: string) => void;
  cardRef?: Ref<HTMLDivElement>;
  showReferenceControls?: boolean;
}) {
  const inputId = `feed-image-input-${post.id}`;
  const progressPct = total > 0 ? Math.round((position / total) * 100) : 0;

  return (
    <article
      ref={cardRef}
      className={cn(
        "ag-studio relative w-full overflow-hidden rounded-2xl border border-ag-border/70 shadow-[var(--ag-shadow-lg)] animate-ag-fade-in",
        post.isConfirmed && "ring-1 ring-ag-success/40"
      )}
    >
      <div className="ag-studio-mesh absolute inset-0 pointer-events-none" aria-hidden />

      <header className="relative z-10 flex flex-col gap-4 px-5 py-4 sm:px-6 border-b border-ag-border/50 bg-ag-surface-1/80 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-full border border-ag-border bg-ag-surface-2/80 p-0.5">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="p-2 rounded-full text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 disabled:opacity-30 cursor-pointer transition-colors"
              aria-label="Post anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className="p-2 rounded-full text-ag-muted hover:text-ag-text hover:bg-ag-surface-3 disabled:opacity-30 cursor-pointer transition-colors"
              aria-label="Próximo post"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 min-w-[140px]">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-ag-muted">
              Planejamento editorial · {position}/{total}
            </p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ag-text leading-none tracking-tight">
                Dia {post.dayNumber}
              </h2>
              <span className="text-sm text-ag-muted font-medium">{post.dateLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border",
                status.badge
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
            {post.isGenerating && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onStopGenerate}
                className="text-ag-danger hover:bg-ag-danger/10 border border-ag-danger/25"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Parar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto sm:ml-auto">
            <Button type="button" variant="ghost" size="sm" onClick={onAddPostToDay} title="Adicionar post neste dia">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Post</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} title="Remover">
              <Trash2 className="h-4 w-4 text-ag-danger" />
            </Button>
            {post.caption && (
              <Button
                type="button"
                variant={post.isConfirmed ? "primary" : "secondary"}
                size="sm"
                onClick={onToggleConfirm}
              >
                <CheckCheck className="h-4 w-4" />
                {post.isConfirmed ? "Aprovado" : "Aprovar"}
              </Button>
            )}
          </div>
        </div>

        <div className="h-1 w-full rounded-full bg-ag-surface-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ag-accent/80 to-ag-accent transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[minmax(260px,0.9fr)_1.4fr_minmax(280px,0.75fr)] xl:divide-x divide-ag-border/50">
        <section className="p-5 sm:p-6 flex flex-col">
          <p className="text-[10px] font-mono uppercase tracking-widest text-ag-muted mb-3">Arte do feed</p>
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
              "group relative flex-1 min-h-[280px] xl:min-h-[360px] rounded-xl overflow-hidden cursor-pointer transition-all",
              "ring-1 ring-inset",
              post.image ? "ring-ag-border bg-ag-surface-2" : "ring-ag-border/80 bg-ag-surface-2/50 hover:ring-ag-accent/50",
              postDragOver && "ring-ag-accent ring-2"
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 gap-2">
                  <span className="text-xs font-medium text-white flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Substituir imagem
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearImage();
                    }}
                    className="text-[10px] font-semibold text-white/90 hover:text-white w-fit cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ag-muted p-6 text-center">
                <div className="h-12 w-12 rounded-2xl bg-ag-accent/10 flex items-center justify-center text-ag-accent">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-ag-text">Arraste a arte do Canva</p>
                <p className="text-xs">ou clique para enviar</p>
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
        </section>

        <section className="p-5 sm:p-6 flex flex-col gap-4 min-w-0 bg-ag-surface-1/50">
          {showReferenceControls && (
          <label className="flex items-start gap-2.5 rounded-xl border border-ag-border/70 bg-ag-surface-2/50 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!!post.captionFromImageOnly}
              onChange={(e) => onToggleCaptionFromImageOnly(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-ag-border text-ag-accent focus:ring-ag-accent/30"
            />
            <span className="min-w-0">
              <span className="text-sm font-medium text-ag-text block">
                Legenda pelo conteúdo da imagem
              </span>
              <span className="text-xs text-ag-muted leading-snug block mt-0.5">
                Artes, banners ou posts com texto — a IA lê a imagem sem comparar ao catálogo
              </span>
            </span>
          </label>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {showReferenceControls && (
            <div className="flex-1 min-w-0">
              <label className="text-[10px] font-mono uppercase tracking-widest text-ag-muted block mb-1.5">
                Referência
              </label>
              <select
                value={post.matchedCatalogId || ""}
                onChange={(e) => onSelectReference(e.target.value || null)}
                disabled={!!post.captionFromImageOnly}
                className={cn(
                  "w-full text-sm rounded-xl px-3 py-2.5 border border-ag-border bg-ag-surface-2 text-ag-text outline-none focus:border-ag-accent focus:ring-2 focus:ring-ag-accent/20",
                  post.captionFromImageOnly && "opacity-50 cursor-not-allowed"
                )}
                title={
                  post.captionFromImageOnly
                    ? "Desativado — modo legenda pela imagem"
                    : undefined
                }
              >
                <option value="">Vincular ao catálogo…</option>
                {referenceCatalog.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            )}
            <Button
              type="button"
              variant={post.isGenerating ? "secondary" : "accent"}
              size="md"
              className={cn(
                "sm:self-end shrink-0",
                post.isGenerating && "border-ag-danger/30 text-ag-danger hover:bg-ag-danger/10"
              )}
              onClick={post.isGenerating ? onStopGenerate : onGenerate}
              disabled={!post.image || !brandGemReady}
              title={
                !brandGemReady
                  ? "Configure o Gem da marca em Configurações antes de gerar legendas"
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

          {post.structuredCopy && (
            <details className="group rounded-xl border border-ag-accent/25 bg-ag-accent/5 open:bg-ag-accent/10 mb-3" open>
              <summary className="px-4 py-2.5 cursor-pointer text-xs font-medium text-ag-text flex items-center gap-2 list-none">
                Copy do cronograma
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-ag-muted group-open:rotate-90 transition-transform" />
              </summary>
              <dl className="px-4 pb-3 space-y-2 text-xs">
                <div>
                  <dt className="text-ag-muted font-mono uppercase tracking-wider text-[10px]">Headline</dt>
                  <dd className="text-ag-text mt-0.5">{post.structuredCopy.headline}</dd>
                </div>
                <div>
                  <dt className="text-ag-muted font-mono uppercase tracking-wider text-[10px]">Frase de Apoio</dt>
                  <dd className="text-ag-text mt-0.5">{post.structuredCopy.subtitle}</dd>
                </div>
                <div>
                  <dt className="text-ag-muted font-mono uppercase tracking-wider text-[10px]">CTA</dt>
                  <dd className="text-ag-text mt-0.5">{post.structuredCopy.cta}</dd>
                </div>
              </dl>
            </details>
          )}

          {post.reasoning && (
            <details className="group rounded-xl border border-ag-border/60 bg-ag-surface-2/40 open:bg-ag-accent/5">
              <summary className="px-4 py-2.5 cursor-pointer text-xs font-medium text-ag-text flex items-center gap-2 list-none">
                <Sparkles className="h-3.5 w-3.5 text-ag-accent" />
                Análise visual da IA
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-ag-muted group-open:rotate-90 transition-transform" />
              </summary>
              <p className="px-4 pb-3 text-xs text-ag-muted leading-relaxed">{post.reasoning}</p>
            </details>
          )}

          {post.error && (
            <AiErrorBanner message={post.error} onRetry={() => onGenerate()} />
          )}

          <div className="flex-1 flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-ag-muted">
                Legenda
                {post.captionModel ? (
                  <span className="ml-2 normal-case tracking-normal font-sans text-ag-muted/80">
                    · {formatGeminiModelIdLabel(post.captionModel)}
                  </span>
                ) : null}
                {post.caption && captionFooter ? (
                  (() => {
                    const mainLen = extractMainCaptionText(post.caption, captionFooter).length;
                    const totalLen = post.caption.length;
                    return (
                      <span className="ml-2 normal-case tracking-normal font-sans text-ag-muted">
                        <span
                          className={
                            mainLen > captionMaxMainChars ? "text-ag-danger font-medium" : ""
                          }
                        >
                          {mainLen}/{captionMaxMainChars} texto
                        </span>
                        <span className="text-ag-muted/70">
                          {" "}
                          · {totalLen}/{INSTAGRAM_CAPTION_HARD_MAX} total
                        </span>
                      </span>
                    );
                  })()
                ) : null}
              </span>
              <div className="flex items-center gap-2">
                {(post.caption || post.isGenerated || post.reasoning) && (
                  <button
                    type="button"
                    onClick={onClearCaption}
                    className="text-xs font-medium text-ag-muted hover:text-ag-danger flex items-center gap-1 cursor-pointer"
                    title="Apagar legenda e recomeçar do zero"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    Remover
                  </button>
                )}
                {post.caption && (
                  <button
                    type="button"
                    onClick={onCopyCaption}
                    className="text-xs font-medium text-ag-accent flex items-center gap-1 hover:opacity-80 cursor-pointer"
                  >
                    {copiedId === post.id ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={post.caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              className="flex-1 w-full min-h-[220px] text-sm leading-relaxed rounded-xl px-4 py-3 border border-ag-border bg-ag-surface-2/80 text-ag-text outline-none resize-y focus:border-ag-accent focus:ring-2 focus:ring-ag-accent/15 placeholder:text-ag-muted/70"
              placeholder="A legenda aparece aqui após gerar com IA (tom definido no Gem). Você pode editar livremente."
            />
          </div>

          {post.caption && (
            <div className="flex gap-2 pt-1 border-t border-ag-border/50">
              <input
                type="text"
                value={refineInstruction}
                onChange={(e) => onRefineInstructionChange(e.target.value)}
                placeholder="Refinar: ex. mais curto, mais hashtags…"
                className="flex-1 text-sm rounded-xl px-4 py-2.5 border border-ag-border bg-ag-surface-2 outline-none focus:border-ag-accent"
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
                size="md"
                onClick={() => onRefine(refineInstruction)}
                disabled={isRefining || !refineInstruction.trim() || post.isGenerating}
              >
                {isRefining ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Refinar"}
              </Button>
            </div>
          )}
        </section>

        <section className="hidden xl:flex flex-col items-center justify-start p-5 sm:p-6 bg-ag-surface-2/30">
          <InstagramPhonePreview post={post} variant="studio" username={profileHandle} />
        </section>
      </div>

      <div className="xl:hidden relative z-10 px-5 pb-5 border-t border-ag-border/50 bg-ag-surface-2/20">
        <InstagramPhonePreview post={post} variant="compact" username={profileHandle} />
      </div>
    </article>
  );
}
