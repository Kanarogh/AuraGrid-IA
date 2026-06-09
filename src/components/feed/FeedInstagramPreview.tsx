import type { PlannedPost } from "../../types";
import { sortPostsForInstagramProfile } from "../../lib/instagramFeedOrder";
import { StudioSection } from "../ui/StudioSection";
import { InstagramProfileMockup } from "./InstagramProfileMockup";

export function FeedInstagramPreview({
  posts,
  profileDisplayName,
  profileHandle,
  activePreviewId,
  swapSourceId,
  onSelectPost,
  onSwapDays,
  onOpenStudio,
}: {
  posts: PlannedPost[];
  profileDisplayName: string;
  profileHandle: string;
  activePreviewId: string;
  swapSourceId: string;
  onSelectPost: (postId: string) => void;
  onSwapDays: (fromId: string, toId: string) => void;
  onOpenStudio?: () => void;
}) {
  const ordered = sortPostsForInstagramProfile(posts).filter((p) => Boolean(p.image));
  const newest = ordered[0];
  const oldest = ordered[ordered.length - 1];

  return (
    <StudioSection
      title="Feed 3×3"
      subtitle={
        <>
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
        </>
      }
      actions={
        onOpenStudio ? (
          <button
            type="button"
            onClick={onOpenStudio}
            className="text-xs font-semibold px-4 py-2 rounded-xl border border-ag-border bg-ag-surface-2 hover:bg-ag-surface-3 cursor-pointer"
          >
            Editar no estúdio
          </button>
        ) : undefined
      }
      noPadding
    >
      <div className="relative flex justify-center py-8 sm:py-10 px-4 sm:px-6">
        <InstagramProfileMockup
          posts={posts}
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
