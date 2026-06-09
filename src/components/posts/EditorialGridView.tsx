import type { CatalogItem, PlannedPost } from "../../types";
import { getPostStatus } from "../../lib/postStatus";
import { StudioSection } from "../ui/StudioSection";
import { EditorialPostCard } from "./EditorialPostCard";
import { CalendarDays, CalendarPlus, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

export function EditorialGridView({
  posts,
  referenceCatalog,
  activePreviewId,
  postDragOver,
  copiedId,
  refineInstructions,
  isRefining,
  brandGemReady = true,
  onAddPostToDay,
  onRemove,
  onToggleConfirm,
  onCopy,
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
  onFocusPost,
  onOpenStudio,
}: {
  posts: PlannedPost[];
  referenceCatalog: CatalogItem[];
  activePreviewId: string;
  postDragOver: Record<string, boolean>;
  copiedId: string | null;
  refineInstructions: Record<string, string>;
  isRefining: Record<string, boolean>;
  brandGemReady?: boolean;
  onAddPostToDay: (dayNumber: number) => void;
  onRemove: (postId: string) => void;
  onToggleConfirm: (postId: string) => void;
  onCopy: (postId: string, caption: string) => void;
  onPhotoUpload: (postId: string, file: File) => void;
  onClearImage: (postId: string) => void;
  onSelectReference: (postId: string, catalogId: string | null) => void;
  onToggleCaptionFromImageOnly: (postId: string, enabled: boolean) => void;
  onGenerate: (postId: string) => void;
  onStopGenerate: (postId: string) => void;
  onCaptionChange: (postId: string, value: string) => void;
  onClearCaption: (postId: string) => void;
  onRefineInstructionChange: (postId: string, value: string) => void;
  onRefine: (postId: string, instruction?: string) => void;
  onFocusPost: (postId: string) => void;
  onOpenStudio?: (postId: string) => void;
}) {
  const withCaption = posts.filter((p) => p.caption?.trim()).length;
  const approved = posts.filter((p) => p.isConfirmed).length;
  const withImage = posts.filter((p) => p.image).length;

  return (
    <StudioSection
      title="Grade 30 dias"
      subtitle={
        <>
          <span className="inline-flex items-center gap-1.5 mr-2">
            <Sparkles className="h-3.5 w-3.5 text-ag-accent" />
            {posts.length} dias · {withImage} com foto · {withCaption} com legenda · {approved} aprovadas
          </span>
          — Role para ver todos os dias ou abra um no modo Estúdio.
        </>
      }
      actions={
        onOpenStudio && activePreviewId ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenStudio(activePreviewId)}
          >
            <CalendarDays className="h-4 w-4" />
            Abrir no estúdio
          </Button>
        ) : undefined
      }
    >
      {posts.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="Nenhum dia no calendário"
          description="Use o painel de distribuição acima para criar os 30 dias do planejamento."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10 gap-2 mb-6">
            {posts.map((post) => {
              const status = getPostStatus(post);
              const isActive = post.id === activePreviewId;
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => {
                    onFocusPost(post.id);
                    document.getElementById(`editorial-row-${post.id}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className={`rounded-lg border p-2 text-left transition-all cursor-pointer ${
                    isActive
                      ? "border-ag-accent bg-ag-accent/10 ring-1 ring-ag-accent/30"
                      : "border-ag-border bg-ag-surface-2 hover:border-ag-accent/40"
                  }`}
                >
                  <span className="font-display text-lg font-semibold text-ag-accent block leading-none">
                    {post.dayNumber}
                  </span>
                  <span className="text-[9px] mt-1 block truncate text-ag-muted">{status.label}</span>
                  <div className="aspect-square mt-2 rounded-md overflow-hidden bg-ag-surface-3 border border-ag-border/50">
                    {post.image ? (
                      <img
                        src={post.image}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-ag-muted">
                        —
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <div key={post.id}>
              <EditorialPostCard
                post={post}
                status={getPostStatus(post)}
                isFocused={post.id === activePreviewId}
                referenceCatalog={referenceCatalog}
                postDragOver={!!postDragOver[post.id]}
                copiedId={copiedId}
                refineInstruction={refineInstructions[post.id] || ""}
                isRefining={!!isRefining[post.id]}
                brandGemReady={brandGemReady}
                onAddPostToDay={() => onAddPostToDay(post.dayNumber)}
                onRemove={() => onRemove(post.id)}
                onToggleConfirm={() => onToggleConfirm(post.id)}
                onCopyCaption={() => onCopy(post.id, post.caption)}
                onPhotoUpload={(file) => onPhotoUpload(post.id, file)}
                onClearImage={() => onClearImage(post.id)}
                onSelectReference={(id) => onSelectReference(post.id, id)}
                onToggleCaptionFromImageOnly={(enabled) =>
                  onToggleCaptionFromImageOnly(post.id, enabled)
                }
                onGenerate={() => onGenerate(post.id)}
                onStopGenerate={() => onStopGenerate(post.id)}
                onCaptionChange={(v) => onCaptionChange(post.id, v)}
                onClearCaption={() => onClearCaption(post.id)}
                onRefineInstructionChange={(v) => onRefineInstructionChange(post.id, v)}
                onRefine={(instruction) => onRefine(post.id, instruction)}
                onFocus={() => onFocusPost(post.id)}
              />
              </div>
            ))}
          </div>
        </>
      )}
    </StudioSection>
  );
}
