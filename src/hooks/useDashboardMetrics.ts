import { useMemo } from "react";
import type { CanvaGridPage, CatalogItem, PlannedPost } from "../types";
import { getCaptionBatchStats, type CaptionBatchStats } from "../lib/captionBatch";

export type DashboardMetrics = {
  captionBatchStats: CaptionBatchStats;
  referenceCount: number;
  canvaImageCount: number;
  canvaSlotTotal: number;
  canvaPageCount: number;
  brandGemReady: boolean;
  brandGemMissingCount: number;
};

type UseDashboardMetricsArgs = {
  posts: PlannedPost[];
  catalog: CatalogItem[];
  canvaPages: CanvaGridPage[];
  referenceCount: number;
  brandGemReady: boolean;
  brandGemMissingCount: number;
};

export function useDashboardMetrics({
  posts,
  catalog,
  canvaPages,
  referenceCount,
  brandGemReady,
  brandGemMissingCount,
}: UseDashboardMetricsArgs): DashboardMetrics {
  const captionBatchStats = useMemo(
    () => getCaptionBatchStats(posts, catalog),
    [posts, catalog]
  );

  const canvaImageCount = useMemo(
    () => canvaPages.flatMap((p) => p.slots).filter((s) => s?.image).length,
    [canvaPages]
  );

  const canvaSlotTotal = useMemo(
    () => canvaPages.flatMap((p) => p.slots).length,
    [canvaPages]
  );

  return {
    captionBatchStats,
    referenceCount,
    canvaImageCount,
    canvaSlotTotal,
    canvaPageCount: canvaPages.length,
    brandGemReady,
    brandGemMissingCount,
  };
}
