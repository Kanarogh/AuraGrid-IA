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
  const refs = getReferenceCatalog(catalog);
  const withImage = posts.filter((p) => !!p.image);

  return {
    total: posts.length,
    withImage: withImage.length,
    withoutImage: posts.length - withImage.length,
    pending: posts.filter((p) => p.image && !p.isGenerated && !p.isGenerating).length,
    generated: posts.filter((p) => p.isGenerated && !!p.caption).length,
    confirmed: posts.filter((p) => p.isConfirmed).length,
    errors: posts.filter((p) => !!p.error).length,
    generating: posts.filter((p) => p.isGenerating).length,
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
