import { POST_COUNT } from "./planningConstants";
import { recalculatePostDates } from "./dates";
import { stablePlannedPostId } from "./postIds";
import {
  computePostsPerDay,
  resolveDistributionOptions,
  type DistributionPrefs,
} from "./smartDistribution";
import type { CanvaGridPage, CanvaGridSlot, PlannedPost } from "../types";

export type CanvaSlotWithPage = CanvaGridSlot & { pageId: string };

export type ScheduleItem = {
  image: string | null;
  imageAssetId?: string | null;
  matchedCatalogId?: string | null;
  label?: string;
  canvaSlotRef?: { pageId: string; slotId: string } | null;
};

export function gatherCanvaSlots(pages: CanvaGridPage[]): CanvaSlotWithPage[] {
  const all: CanvaSlotWithPage[] = [];
  for (const page of pages || []) {
    if (!page?.slots) continue;
    for (const slot of page.slots) {
      if (!slot) continue;
      all.push({ ...slot, pageId: page.id });
    }
  }
  return all;
}

export function countCanvaImages(pages: CanvaGridPage[]): number {
  return gatherCanvaSlots(pages).filter((s) => s?.image != null).length;
}

export function canvaSlotsToScheduleItems(
  pages: CanvaGridPage[],
  reversed: boolean
): ScheduleItem[] {
  let ordered = gatherCanvaSlots(pages).filter((s) => s?.image != null);
  if (reversed) ordered = [...ordered].reverse();
  return ordered.map((slot) => ({
    image: slot.image,
    imageAssetId: slot.imageAssetId ?? null,
    matchedCatalogId: slot.matchedCatalogId ?? null,
    label: slot.label,
    canvaSlotRef: { pageId: slot.pageId, slotId: slot.id },
  }));
}

function shouldPreserveSyncedPost(
  existing: PlannedPost | undefined,
  item: ScheduleItem
): boolean {
  if (!existing) return false;

  const hasEditorial =
    !!existing.caption?.trim() ||
    existing.isGenerated ||
    existing.isConfirmed ||
    !!existing.reasoning?.trim();

  if (hasEditorial) return true;

  if (existing.image && existing.image === item.image) return true;
  if (
    item.canvaSlotRef &&
    existing.canvaSlotRef?.pageId === item.canvaSlotRef.pageId &&
    existing.canvaSlotRef?.slotId === item.canvaSlotRef.slotId
  ) {
    return true;
  }
  return false;
}

export function buildPostsFromSchedule(
  items: ScheduleItem[],
  postsPerDay: number[],
  existingPosts: PlannedPost[],
  startDate: string
): PlannedPost[] {
  const validItems = items.filter((i) => i.image != null);
  const existingById = new Map(existingPosts.map((p) => [p.id, p]));
  const resultPosts: PlannedPost[] = [];
  let itemIndex = 0;
  const totalDays = postsPerDay.length;

  for (let dIndex = 0; dIndex < totalDays; dIndex++) {
    const dayNum = dIndex + 1;
    const countForDay = postsPerDay[dIndex];

    if (countForDay === 0) {
      const postId = stablePlannedPostId(dayNum, 0);
      const existingAtSlot = existingById.get(postId) ?? existingPosts[resultPosts.length];

      if (existingAtSlot && existingAtSlot.image === null) {
        resultPosts.push({
          ...existingAtSlot,
          id: postId,
          dayNumber: dayNum,
          dateLabel: "",
        });
      } else {
        resultPosts.push({
          id: postId,
          dayNumber: dayNum,
          dateLabel: "",
          image: null,
          imageAssetId: null,
          matchedCatalogId: null,
          canvaSlotRef: null,
          reasoning: null,
          caption: "",
          isGenerating: false,
          isGenerated: false,
          isConfirmed: false,
          error: null,
        });
      }
    } else {
      for (let pIndex = 0; pIndex < countForDay; pIndex++) {
        const item = validItems[itemIndex];
        itemIndex++;

        const postId = stablePlannedPostId(dayNum, pIndex);
        const existingAtSlot = existingById.get(postId) ?? existingPosts[resultPosts.length];

        if (item && shouldPreserveSyncedPost(existingAtSlot, item)) {
          resultPosts.push({
            ...existingAtSlot!,
            id: postId,
            image: item.image,
            imageAssetId: item.imageAssetId ?? existingAtSlot!.imageAssetId ?? null,
            matchedCatalogId:
              existingAtSlot!.matchedCatalogId ?? item.matchedCatalogId ?? null,
            canvaSlotRef: item.canvaSlotRef ?? existingAtSlot!.canvaSlotRef ?? null,
            dayNumber: dayNum,
            dateLabel: "",
          });
        } else {
          resultPosts.push({
            id: postId,
            dayNumber: dayNum,
            dateLabel: "",
            image: item?.image ?? null,
            imageAssetId: item?.imageAssetId ?? null,
            matchedCatalogId: item?.matchedCatalogId ?? null,
            canvaSlotRef: item?.canvaSlotRef ?? null,
            reasoning:
              item?.matchedCatalogId || item?.canvaSlotRef
                ? "Vínculo automático via distribuidor inteligente do Grid Canva."
                : null,
            caption: existingAtSlot?.caption ?? "",
            isGenerating: false,
            isGenerated: existingAtSlot?.isGenerated ?? false,
            isConfirmed: existingAtSlot?.isConfirmed ?? false,
            error: null,
          });
        }
      }
    }
  }

  return recalculatePostDates(startDate, resultPosts);
}

/** Distribui looks do Canva Grid no roteiro de 30 dias, preservando legendas existentes. */
export function syncCanvaPagesToPosts(
  pages: CanvaGridPage[],
  existingPosts: PlannedPost[],
  startDate: string,
  options: { reversed: boolean; distribution: DistributionPrefs }
): PlannedPost[] {
  const items = canvaSlotsToScheduleItems(pages, options.reversed);
  if (items.length === 0) return existingPosts;

  const resolved = resolveDistributionOptions(items.length, options.distribution, POST_COUNT);
  const postsPerDay = computePostsPerDay(items.length, resolved);
  return buildPostsFromSchedule(items, postsPerDay, existingPosts, startDate);
}

export function scheduleItemsToPosts(
  items: ScheduleItem[],
  existingPosts: PlannedPost[],
  startDate: string,
  distribution: DistributionPrefs
): PlannedPost[] {
  const validCount = items.filter((i) => i.image != null).length;
  if (validCount === 0) return existingPosts;

  const resolved = resolveDistributionOptions(validCount, distribution, POST_COUNT);
  const postsPerDay = computePostsPerDay(validCount, resolved);
  return buildPostsFromSchedule(items, postsPerDay, existingPosts, startDate);
}
