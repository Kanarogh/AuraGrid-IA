import type { CanvaGridPage, PlannedPost } from "../../types";
import { sortPostsForInstagramProfile } from "../../lib/instagramFeedOrder";
import { StudioSection } from "../ui/StudioSection";
import { Button } from "../ui/Button";
import { InstagramProfileMockup } from "./InstagramProfileMockup";

export function FeedInstagramPreview({
  posts,
  canvaPages,
  canvaGridReversed,
  profileDisplayName,
  profileHandle,
  activePreviewId,
  swapSourceId,
  onSelectPost,
  onSwapDays,
  onOpenStudio,
}: {
  posts: PlannedPost[];
  canvaPages?: CanvaGridPage[];
  canvaGridReversed?: boolean;
  profileDisplayName: string;
  profileHandle: string;
  activePreviewId: string;
  swapSourceId: string;
  onSelectPost: (postId: string) => void;
  onSwapDays: (fromId: string, toId: string) => void;
  onOpenStudio?: () => void;
}) {
  const ordered = sortPostsForInstagramProfile(posts, {
    canvaPages,
    canvaGridReversed,
  }).filter((p) => Boolean(p.image));
  const newest = ordered[0];
  const oldest = ordered[ordered.length - 1];

  return (
    <StudioSection
      titleMode="hidden"
      eyebrow="Produção visual"
      actions={
        onOpenStudio ? (
          <Button type="button" variant="secondary" size="sm" onClick={onOpenStudio}>
            Editar no estúdio
          </Button>
        ) : undefined
      }
      noPadding
    >
      <p className="text-sm text-ag-muted leading-relaxed max-w-3xl px-4 sm:px-6 pt-5 sm:pt-6">
        Prévia do perfil no estilo Instagram · miniaturas 4:5.
        {ordered.length > 0 ? (
          <>
            {" "}
            <strong className="text-ag-text">{ordered.length}</strong>{" "}
            {ordered.length === 1 ? "foto" : "fotos"} — mais recente{" "}
            {newest ? `(D${newest.dayNumber})` : ""}, mais antiga{" "}
            {oldest ? `(D${oldest.dayNumber})` : ""}.
          </>
        ) : (
          " Adicione looks nos roteiros."
        )}
      </p>
      <div className="relative flex justify-center py-8 sm:py-10 px-4 sm:px-6">
        <InstagramProfileMockup
          posts={posts}
          canvaPages={canvaPages}
          canvaGridReversed={canvaGridReversed}
          displayName={profileDisplayName}
          username={profileHandle}
          activePreviewId={activePreviewId}
          swapSourceId={swapSourceId}
          onSelectPost={onSelectPost}
          onSwapDays={onSwapDays}
        />
      </div>
    </StudioSection>
  );
}
