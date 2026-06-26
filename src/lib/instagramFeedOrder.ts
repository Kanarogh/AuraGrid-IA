import { canvaSlotsToScheduleItems } from "./canvaTimelineSync";
import type { CanvaGridPage, PlannedPost } from "../types";

export type InstagramFeedOrderOptions = {
  canvaPages?: CanvaGridPage[];
  canvaGridReversed?: boolean;
};

function canvaSlotKey(ref: { pageId: string; slotId: string }): string {
  return `${ref.pageId}:${ref.slotId}`;
}

/** Índice de publicação (0 = primeiro a publicar) por slot do Canva. */
export function buildCanvaScheduleIndexMap(
  pages: CanvaGridPage[],
  reversed: boolean
): Map<string, number> {
  const items = canvaSlotsToScheduleItems(pages, reversed);
  const map = new Map<string, number>();
  items.forEach((item, index) => {
    if (!item.canvaSlotRef) return;
    map.set(canvaSlotKey(item.canvaSlotRef), index);
  });
  return map;
}

function postSlotInDay(postId: string): number {
  const match = /_p(\d+)$/.exec(postId);
  return match ? Number(match[1]) : 0;
}

function compareByDayAndSlot(a: PlannedPost, b: PlannedPost): number {
  if (b.dayNumber !== a.dayNumber) return b.dayNumber - a.dayNumber;
  const slotA = postSlotInDay(a.id);
  const slotB = postSlotInDay(b.id);
  if (slotB !== slotA) return slotB - slotA;
  return a.id.localeCompare(b.id);
}

function compareByCanvaSchedule(
  a: PlannedPost,
  b: PlannedPost,
  scheduleIndex: Map<string, number>
): number | null {
  const indexA = a.canvaSlotRef
    ? scheduleIndex.get(canvaSlotKey(a.canvaSlotRef))
    : undefined;
  const indexB = b.canvaSlotRef
    ? scheduleIndex.get(canvaSlotKey(b.canvaSlotRef))
    : undefined;

  if (indexA !== undefined && indexB !== undefined) {
    if (indexB !== indexA) return indexB - indexA;
    return a.id.localeCompare(b.id);
  }
  if (indexA !== undefined && indexB === undefined) return -1;
  if (indexA === undefined && indexB !== undefined) return 1;
  return null;
}

/**
 * Ordem de exibição no perfil Instagram: canto superior esquerdo = post mais recente.
 * Com Grid Canva, usa a sequência de publicação do Canva (não só dayNumber do roteiro).
 */
export function sortPostsForInstagramProfile(
  posts: PlannedPost[],
  options?: InstagramFeedOrderOptions
): PlannedPost[] {
  const pages = options?.canvaPages;
  const scheduleIndex =
    pages && pages.length > 0
      ? buildCanvaScheduleIndexMap(pages, options?.canvaGridReversed ?? true)
      : null;

  if (!scheduleIndex || scheduleIndex.size === 0) {
    return [...posts].sort(compareByDayAndSlot);
  }

  const canvaOrdered: PlannedPost[] = [];
  const usedIds = new Set<string>();

  const scheduleItems = canvaSlotsToScheduleItems(
    pages!,
    options?.canvaGridReversed ?? true
  );
  for (let i = scheduleItems.length - 1; i >= 0; i--) {
    const ref = scheduleItems[i]?.canvaSlotRef;
    if (!ref) continue;
    const post = posts.find(
      (p) =>
        p.image &&
        !usedIds.has(p.id) &&
        p.canvaSlotRef?.pageId === ref.pageId &&
        p.canvaSlotRef?.slotId === ref.slotId
    );
    if (post) {
      canvaOrdered.push(post);
      usedIds.add(post.id);
    }
  }

  const remaining = posts
    .filter((p) => p.image && !usedIds.has(p.id))
    .sort((a, b) => {
      const byCanva = compareByCanvaSchedule(a, b, scheduleIndex);
      if (byCanva !== null) return byCanva;
      return compareByDayAndSlot(a, b);
    });

  return [...canvaOrdered, ...remaining];
}

/** Índice visual no grid (0 = topo-esquerda) → rótulo de leitura para o usuário */
export function instagramGridPositionLabel(index: number, cols = 3): {
  row: number;
  col: number;
} {
  return { row: Math.floor(index / cols) + 1, col: (index % cols) + 1 };
}
