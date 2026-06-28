import type { CatalogItem, PlannedPost } from "../types";
import { getReferenceCatalog, isCatalogItemIndexed } from "./catalog";
import { catalogReadyForTextMatch } from "./catalogEnrichment";
import { isPublishReadyPost } from "./publish/publishReadiness";

export interface CaptionBatchStats {
  total: number;
  withImage: number;
  withoutImage: number;
  pending: number;
  generated: number;
  confirmed: number;
  publishReady: number;
  errors: number;
  generating: number;
  catalogTotal: number;
  catalogIndexed: number;
  catalogReady: boolean;
}

export function getCaptionBatchStats(
  posts: PlannedPost[],
  catalog: CatalogItem[],
  usesReferences = true
): CaptionBatchStats {
  const safePosts = posts.filter((p): p is PlannedPost => !!p?.id);
  const refs = usesReferences
    ? getReferenceCatalog(catalog.filter((c): c is CatalogItem => !!c?.id))
    : [];
  const withImage = safePosts.filter((p) => !!p.image);

  return {
    total: safePosts.length,
    withImage: withImage.length,
    withoutImage: safePosts.length - withImage.length,
    pending: safePosts.filter((p) => p.image && !p.isGenerated && !p.isGenerating).length,
    generated: safePosts.filter((p) => p.isGenerated && !!p.caption).length,
    confirmed: safePosts.filter((p) => p.isConfirmed).length,
    publishReady: safePosts.filter((p) => isPublishReadyPost(p)).length,
    errors: safePosts.filter((p) => !!p.error).length,
    generating: safePosts.filter((p) => p.isGenerating).length,
    catalogTotal: refs.length,
    catalogIndexed: refs.filter(isCatalogItemIndexed).length,
    catalogReady: usesReferences ? catalogReadyForTextMatch(refs) : true,
  };
}

export function getPendingCaptionPosts(posts: PlannedPost[]): PlannedPost[] {
  return posts.filter((p) => p.image && !p.isGenerated && !p.isGenerating);
}

export function getRegeneratablePosts(posts: PlannedPost[]): PlannedPost[] {
  return posts.filter((p) => p.image && (p.isGenerated || !!p.error) && !p.isGenerating);
}
