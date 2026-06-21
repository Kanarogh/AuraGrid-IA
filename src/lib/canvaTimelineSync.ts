import { POST_COUNT } from "./planningConstants";
import { recalculatePostDates } from "./dates";
import { stablePlannedPostId } from "./postIds";
import type { CanvaGridPage, CanvaGridSlot, PlannedPost } from "../types";

export type CanvaSlotWithPage = CanvaGridSlot & { pageId: string };

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

function shouldPreserveSyncedPost(
  existing: PlannedPost | undefined,
  item: CanvaSlotWithPage
): boolean {
  if (!existing) return false;

  const hasEditorial =
    !!existing.caption?.trim() ||
    existing.isGenerated ||
    existing.isConfirmed ||
    !!existing.reasoning?.trim();

  // Mesmo dia/slot no calendário: mantém legenda aprovada ou gerada (foto pode mudar)
  if (hasEditorial) return true;

  if (existing.image && existing.image === item.image) return true;
  if (existing.canvaSlotRef?.slotId === item.id) return true;
  if (
    existing.canvaSlotRef?.pageId === item.pageId &&
    existing.canvaSlotRef?.slotId === item.id
  ) {
    return true;
  }
  return false;
}

/** Distribui looks do Canva Grid no roteiro de 30 dias, preservando legendas existentes. */
export function syncCanvaPagesToPosts(
  pages: CanvaGridPage[],
  existingPosts: PlannedPost[],
  startDate: string,
  options: { reversed: boolean }
): PlannedPost[] {
  const validSlots = gatherCanvaSlots(pages).filter((s) => s?.image != null);
  if (validSlots.length === 0) return existingPosts;

  let orderedSlots = [...validSlots];
  if (options.reversed) {
    orderedSlots.reverse();
  }

  const N = orderedSlots.length;
  const postsPerDay = Array(POST_COUNT).fill(0);

  if (N >= POST_COUNT) {
    for (let i = 0; i < POST_COUNT; i++) postsPerDay[i] = 1;
    let remaining = N - POST_COUNT;
    let d = 0;
    while (remaining > 0 && d < POST_COUNT) {
      const currentSpace = 3 - postsPerDay[d];
      if (currentSpace > 0) {
        const add = Math.min(currentSpace, remaining);
        postsPerDay[d] += add;
        remaining -= add;
      }
      d++;
    }
    let cycle = 0;
    while (remaining > 0) {
      postsPerDay[cycle % POST_COUNT] += 1;
      remaining--;
      cycle++;
    }
  } else {
    for (let i = 0; i < N; i++) postsPerDay[i] = 1;
    for (let i = N; i < POST_COUNT; i++) postsPerDay[i] = 0;
  }

  const existing = [...(existingPosts || [])];
  const existingById = new Map(existing.map((p) => [p.id, p]));
  const resultPosts: PlannedPost[] = [];
  let itemIndex = 0;

  for (let dIndex = 0; dIndex < POST_COUNT; dIndex++) {
    const dayNum = dIndex + 1;
    const countForDay = postsPerDay[dIndex];

    if (countForDay === 0) {
      const postId = stablePlannedPostId(dayNum, 0);
      const existingAtSlot = existingById.get(postId) ?? existing[resultPosts.length];

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
        const item = orderedSlots[itemIndex];
        itemIndex++;

        const postId = stablePlannedPostId(dayNum, pIndex);
        const existingAtSlot = existingById.get(postId) ?? existing[resultPosts.length];

        if (item && shouldPreserveSyncedPost(existingAtSlot, item)) {
          resultPosts.push({
            ...existingAtSlot!,
            id: postId,
            image: item.image,
            imageAssetId: item.imageAssetId ?? existingAtSlot!.imageAssetId ?? null,
            matchedCatalogId:
              existingAtSlot!.matchedCatalogId ?? item.matchedCatalogId ?? null,
            canvaSlotRef: { pageId: item.pageId, slotId: item.id },
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
            canvaSlotRef: item ? { pageId: item.pageId, slotId: item.id } : null,
            reasoning:
              item?.matchedCatalogId
                ? "Vínculo automático via distribuidor inteligente de acervo."
                : null,
            caption: "",
            isGenerating: false,
            isGenerated: false,
            isConfirmed: false,
            error: null,
          });
        }
      }
    }
  }

  return recalculatePostDates(startDate, resultPosts);
}
