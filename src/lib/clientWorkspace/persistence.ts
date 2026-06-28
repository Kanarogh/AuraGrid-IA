import { countCanvaImages, syncCanvaPagesToPosts } from "../canvaTimelineSync";
import { DEFAULT_DISTRIBUTION_PREFS } from "../smartDistribution";
import type { CanvaGridPage, PlannedPost } from "../../types";
import type { ClientWorkspace } from "./types";

export type CanvaSlotApiPatch = {
  id: string;
  label: string | null;
  matchedCatalogId: string | null;
  imageAssetId: string | null;
};

function findCanvaSlot(
  pages: CanvaGridPage[],
  pageId: string,
  slotId: string
) {
  const page = pages.find((p) => p.id === pageId);
  return page?.slots.find((s) => s.id === slotId);
}

function findSlotByImage(pages: CanvaGridPage[], image: string) {
  for (const page of pages) {
    for (const slot of page.slots) {
      if (slot.image === image) {
        return { pageId: page.id, slotId: slot.id };
      }
    }
  }
  return null;
}

export function stripTransientPostFields(post: PlannedPost): PlannedPost {
  return {
    ...post,
    isGenerating: false,
    error: post.error && post.isGenerated ? post.error : null,
  };
}

/** PATCH na nuvem: só campos persistidos no Postgres (sem preview local/base64). */
export function compactPostForApiPatch(post: PlannedPost) {
  const cleaned = stripTransientPostFields(post);
  return {
    id: cleaned.id,
    dayNumber: cleaned.dayNumber,
    dateLabel: cleaned.dateLabel,
    imageAssetId: cleaned.imageAssetId ?? null,
    matchedCatalogId: cleaned.matchedCatalogId,
    reasoning: cleaned.reasoning,
    caption: cleaned.caption ?? "",
    isGenerated: cleaned.isGenerated ?? false,
    isConfirmed: cleaned.isConfirmed === true,
    captionFromImageOnly: cleaned.captionFromImageOnly ?? false,
    captionFromSchedule: cleaned.captionFromSchedule ?? false,
    captionModel: cleaned.captionModel ?? null,
    structuredCopy: cleaned.structuredCopy ?? null,
    error: cleaned.error,
    canvaSlotRef: cleaned.canvaSlotRef ?? null,
  };
}

/** PATCH na nuvem: só metadados do slot (imagem via imageAssetId). */
export function compactCanvaForApiPatch(canva: ClientWorkspace["canva"]) {
  return {
    activePageId: canva.activePageId,
    autoSync: canva.autoSync,
    reversed: canva.reversed,
    gridFormat: canva.gridFormat,
    gridMaxWidth: canva.gridMaxWidth,
    pages: canva.pages.map((page) => ({
      id: page.id,
      name: page.name,
      slots: page.slots.map(
        (slot): CanvaSlotApiPatch => ({
          id: slot.id,
          label: slot.label,
          matchedCatalogId: slot.matchedCatalogId,
          imageAssetId: slot.imageAssetId ?? null,
        })
      ),
    })),
  };
}

/** Preenche imagens dos posts a partir do Canva (após compactação no save). */
export function hydrateWorkspaceFromStorage(workspace: ClientWorkspace): ClientWorkspace {
  const pages = workspace.canva.pages;
  let posts = workspace.posts.map(stripTransientPostFields);

  posts = posts.map((post) => {
    if (post.image) return post;
    if (!post.canvaSlotRef) return post;
    const slot = findCanvaSlot(
      pages,
      post.canvaSlotRef.pageId,
      post.canvaSlotRef.slotId
    );
    if (!slot?.image) return post;
    return {
      ...post,
      image: slot.image,
      matchedCatalogId: post.matchedCatalogId ?? slot.matchedCatalogId,
    };
  });

  if (workspace.canva.autoSync && countCanvaImages(pages) > 0) {
    posts = syncCanvaPagesToPosts(pages, posts, workspace.startDate, {
      reversed: workspace.canva.reversed,
      distribution: workspace.ui?.distributionPrefs ?? DEFAULT_DISTRIBUTION_PREFS,
    });
  }

  return { ...workspace, posts };
}

/** Remove imagens duplicadas (já presentes no Canva) para caber no localStorage. */
export function compactWorkspaceForStorage(workspace: ClientWorkspace): ClientWorkspace {
  const pages = workspace.canva.pages;
  const posts = workspace.posts.map((post) => {
    const cleaned = stripTransientPostFields(post);
    if (!cleaned.image) return cleaned;

    const slotRef =
      cleaned.canvaSlotRef ?? findSlotByImage(pages, cleaned.image);
    if (!slotRef) return cleaned;

    const slot = findCanvaSlot(pages, slotRef.pageId, slotRef.slotId);
    if (slot?.image === cleaned.image) {
      return {
        ...cleaned,
        image: null,
        canvaSlotRef: slotRef,
      };
    }
    return cleaned;
  });

  return { ...workspace, posts };
}

export function isStorageQuotaError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  return (
    err.name === "QuotaExceededError" ||
    err.code === 22 ||
    err.code === 1014
  );
}
