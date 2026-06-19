import { createEmptyCanvaPage, getDefaultActiveCanvaPageId, normalizeCanvaPages } from "../canva";
import {
  DEFAULT_CANVA_GRID_FORMAT,
  getCanvaGridFormat,
  isCanvaGridFormatId,
} from "../canvaGridFormats";
import { recalculatePostDates } from "../dates";
import {
  clearFactoryPlaceholderGem,
  createEmptyBrandGem,
} from "../brandGemDefaults";
import { normalizeCaptionGenerationParams } from "../captionParams";
import type { BrandGem, CanvaGridPage, PlannedPost } from "../../types";
import type { ClientMeta, ClientWorkspace } from "./types";

const DEFAULT_START_DATE = "2026-05-24";
const POST_COUNT = 30;

export function slugifyClientName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "cliente";
}

export function uniqueClientId(baseSlug: string, existingIds: string[]): string {
  let id = baseSlug;
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${baseSlug}-${n}`;
    n += 1;
  }
  return id;
}

export function createEmptyPosts(count = POST_COUNT): PlannedPost[] {
  const posts: PlannedPost[] = [];
  for (let d = 1; d <= count; d++) {
    posts.push({
      id: `post_day${d}`,
      dayNumber: d,
      dateLabel: `Dia ${d}`,
      image: null,
      matchedCatalogId: null,
      reasoning: null,
      caption: "",
      isGenerating: false,
      isGenerated: false,
      isConfirmed: false,
      error: null,
    });
  }
  return posts;
}

export function createDefaultCanvaPages() {
  return [
    createEmptyCanvaPage("Página 1", "page_1"),
    createEmptyCanvaPage("Página 2", "page_2"),
    createEmptyCanvaPage("Página 3", "page_3"),
    createEmptyCanvaPage("Página 4", "page_4"),
  ];
}

function resolveActivePageId(
  pages: CanvaGridPage[],
  savedId: string | undefined,
  fallbackId: string
): string {
  if (savedId && pages.some((p) => p.id === savedId)) return savedId;
  return getDefaultActiveCanvaPageId(pages) || fallbackId;
}

export function createClientMeta(id: string, name: string): ClientMeta {
  const now = new Date().toISOString();
  return {
    id,
    name: name.trim() || id,
    instagramHandle: id.replace(/-/g, "_"),
    createdAt: now,
    updatedAt: now,
  };
}

export function createBrandGemForClient(id: string, name: string): BrandGem {
  return createEmptyBrandGem(id, name.trim() || id);
}

/** Workspace em memória quando não há cliente ativo (não persiste). */
export function createOrphanWorkspace(): ClientWorkspace {
  return createEmptyWorkspace(createClientMeta("_orphan", "—"));
}

export function createEmptyWorkspace(meta: ClientMeta): ClientWorkspace {
  const startDate = DEFAULT_START_DATE;
  const posts = recalculatePostDates(startDate, createEmptyPosts());
  const defaultPages = createDefaultCanvaPages();
  return {
    version: 1,
    brandGem: createBrandGemForClient(meta.id, meta.name),
    catalog: [],
    posts,
    startDate,
    canva: {
      pages: defaultPages,
      activePageId: getDefaultActiveCanvaPageId(defaultPages),
      autoSync: true,
      reversed: true,
      gridFormat: DEFAULT_CANVA_GRID_FORMAT,
      gridMaxWidth: getCanvaGridFormat(DEFAULT_CANVA_GRID_FORMAT).defaultMaxWidth,
    },
    ui: {
      activeSection: "posts",
      activePreviewId: "post_day1",
      viewMode: "split",
    },
  };
}

/** Garante estrutura completa (ex.: dados antigos sem `canva`). */
export function normalizeWorkspace(
  raw: Partial<ClientWorkspace> | null | undefined,
  meta: ClientMeta
): ClientWorkspace {
  const empty = createEmptyWorkspace(meta);
  if (!raw) return empty;

  let brandGem = raw.brandGem
    ? {
        ...empty.brandGem,
        ...raw.brandGem,
        id: meta.id,
        footer: {
          ...empty.brandGem.footer,
          ...(raw.brandGem.footer ?? {}),
          structure: raw.brandGem.footer?.structure ?? "",
          customFields: Array.isArray(raw.brandGem.footer?.customFields)
            ? raw.brandGem.footer.customFields
            : empty.brandGem.footer.customFields,
        },
      }
    : { ...empty.brandGem, id: meta.id };

  brandGem = clearFactoryPlaceholderGem(brandGem, meta.name);

  brandGem = {
    ...brandGem,
    captionParams: normalizeCaptionGenerationParams(
      raw.brandGem?.captionParams ?? brandGem.captionParams
    ),
  };

  const pages = normalizeCanvaPages(
    Array.isArray(raw.canva?.pages) && raw.canva.pages.length > 0
      ? raw.canva.pages
      : empty.canva.pages
  );

  return {
    version: 1,
    brandGem,
    catalog: Array.isArray(raw.catalog) ? raw.catalog : empty.catalog,
    posts: Array.isArray(raw.posts) && raw.posts.length > 0 ? raw.posts : empty.posts,
    startDate: typeof raw.startDate === "string" ? raw.startDate : empty.startDate,
    canva: {
      pages,
      activePageId: resolveActivePageId(
        pages,
        raw.canva?.activePageId,
        empty.canva.activePageId
      ),
      autoSync: raw.canva?.autoSync ?? empty.canva.autoSync,
      reversed: raw.canva?.reversed ?? empty.canva.reversed,
      gridFormat: isCanvaGridFormatId(raw.canva?.gridFormat)
        ? raw.canva.gridFormat
        : empty.canva.gridFormat,
      gridMaxWidth:
        typeof raw.canva?.gridMaxWidth === "number"
          ? raw.canva.gridMaxWidth
          : getCanvaGridFormat(
              isCanvaGridFormatId(raw.canva?.gridFormat)
                ? raw.canva.gridFormat
                : DEFAULT_CANVA_GRID_FORMAT
            ).defaultMaxWidth,
    },
    ui: { ...empty.ui, ...raw.ui },
  };
}
