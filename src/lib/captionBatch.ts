import type { CatalogItem, PlannedPost } from "../types";
import { getReferenceCatalog } from "./catalog";
import { catalogReadyForTextMatch } from "./catalogEnrichment";

export interface CaptionBatchStats {
  total: number;
  withImage: number;
  withoutImage: number;
  pending: number;
  generated: number;
  confirmed: number;
  errors: number;
  generating: number;
  catalogTotal: number;
  catalogIndexed: number;
  catalogReady: boolean;
}

export function getCaptionBatchStats(
  posts: PlannedPost[],
  catalog: CatalogItem[]
): CaptionBatchStats {
  const safePosts = posts.filter((p): p is PlannedPost => !!p?.id);
  const refs = getReferenceCatalog(catalog.filter((c): c is CatalogItem => !!c?.id));
  const withImage = safePosts.filter((p) => !!p.image);

  return {
    total: safePosts.length,
    withImage: withImage.length,
    withoutImage: safePosts.length - withImage.length,
    pending: safePosts.filter((p) => p.image && !p.isGenerated && !p.isGenerating).length,
    generated: safePosts.filter((p) => p.isGenerated && !!p.caption).length,
    confirmed: safePosts.filter((p) => p.isConfirmed).length,
    errors: safePosts.filter((p) => !!p.error).length,
    generating: safePosts.filter((p) => p.isGenerating).length,
    catalogTotal: refs.length,
    catalogIndexed: refs.filter((c) => c.enrichmentStatus === "ready" && c.visualProfile).length,
    catalogReady: catalogReadyForTextMatch(refs),
  };
}

export function getPendingCaptionPosts(posts: PlannedPost[]): PlannedPost[] {
  return posts.filter((p) => p.image && !p.isGenerated && !p.isGenerating);
}

export function getRegeneratablePosts(posts: PlannedPost[]): PlannedPost[] {
  return posts.filter((p) => p.image && (p.isGenerated || !!p.error) && !p.isGenerating);
}
