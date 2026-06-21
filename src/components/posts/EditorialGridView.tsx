import type { CatalogItem, PlannedPost } from "../../types";
import { getPostStatus } from "../../lib/postStatus";
import { WorkspaceCard, WorkspaceCardHeader } from "../layout/WorkspaceCard";
import { CalendarDays, CalendarPlus, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { cn } from "../../lib/cn";

export function EditorialGridView({
  posts,
  activePreviewId,
  compactReview = true,
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
  compactReview?: boolean;
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
    <WorkspaceCard variant="primary">
      <WorkspaceCardHeader
        title="Visão do calendário"
        subtitle={`${posts.length} dias · ${withImage} com foto · ${withCaption} com legenda · ${approved} aprovadas`}
        actions={
          onOpenStudio && activePreviewId ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenStudio(activePreviewId)}
            >
              <CalendarDays className="h-4 w-4" />
              Abrir dia selecionado
            </Button>
          ) : undefined
        }
      />

      {posts.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="Nenhum dia no calendário"
          description="Use a aba Setup para popular os 30 dias do planejamento."
        />
      ) : compactReview ? (
        <ul className="divide-y divide-ag-border/60 rounded-xl border border-ag-border/60 overflow-hidden">
          {posts.map((post) => {
            const status = getPostStatus(post);
            const isActive = post.id === activePreviewId;
            return (
              <li
                key={post.id}
                id={`editorial-row-${post.id}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 bg-ag-surface-1 transition-colors",
                  isActive && "bg-ag-accent-soft/30"
                )}
              >
                <div className="h-12 w-12 rounded-lg overflow-hidden bg-ag-surface-3 border border-ag-border/50 shrink-0">
                  {post.image ? (
                    <img
                      src={post.image}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-ag-muted">
                      —
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ag-text">
                    Dia {post.dayNumber}
                    <span className="text-ag-muted font-normal ml-2 text-xs">{post.dateLabel}</span>
                  </p>
                  <p className="text-xs text-ag-muted truncate flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-ag-accent shrink-0" />
                    {status.label}
                    {post.caption?.trim() ? " · com legenda" : ""}
                  </p>
                </div>
                {onOpenStudio && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenStudio(post.id)}
                  >
                    Abrir
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </WorkspaceCard>
  );
}
