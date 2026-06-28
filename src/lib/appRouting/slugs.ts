import type { AppSection } from "../sectionMeta";
import type { PostsWorkTab } from "../../components/posts/PostsWorkspaceToolbar";
import type { AccountTab, CatalogTab, SettingsTab } from "./types";

export const SECTION_SLUGS: Record<AppSection, string> = {
  content_schedule: "cronograma",
  posts: "roteiros",
  post_scheduling: "programar-posts",
  canva_grid: "grid-canva",
  feed_simulator: "feed",
  catalog: "catalogo",
  reference_finder: "buscar-referencia",
  settings: "configuracoes",
};

const SLUG_TO_SECTION = Object.fromEntries(
  Object.entries(SECTION_SLUGS).map(([section, slug]) => [slug, section])
) as Record<string, AppSection>;

export const POSTS_TAB_SLUGS: Record<PostsWorkTab, string> = {
  day: "dia",
  calendar: "calendario",
  setup: "setup",
};

const SLUG_TO_POSTS_TAB = Object.fromEntries(
  Object.entries(POSTS_TAB_SLUGS).map(([tab, slug]) => [slug, tab])
) as Record<string, PostsWorkTab>;

export const CATALOG_TAB_SLUGS: Record<CatalogTab, string> = {
  references: "referencias",
  grid: "grid",
};

const SLUG_TO_CATALOG_TAB = Object.fromEntries(
  Object.entries(CATALOG_TAB_SLUGS).map(([tab, slug]) => [slug, tab])
) as Record<string, CatalogTab>;

export const SETTINGS_TAB_SLUGS: Record<SettingsTab, string> = {
  brand: "marca",
  captions: "legendas",
};

const SLUG_TO_SETTINGS_TAB = Object.fromEntries(
  Object.entries(SETTINGS_TAB_SLUGS).map(([tab, slug]) => [slug, tab])
) as Record<string, SettingsTab>;

export const ACCOUNT_TAB_SLUGS: Record<AccountTab, string> = {
  team: "equipe",
  appearance: "aparencia",
  ai: "ia",
};

const SLUG_TO_ACCOUNT_TAB = Object.fromEntries(
  Object.entries(ACCOUNT_TAB_SLUGS).map(([tab, slug]) => [slug, tab])
) as Record<string, AccountTab>;

/** Tabs de conta que antes viviam em /c/:id/configuracoes/… */
export const LEGACY_ACCOUNT_SETTINGS_SLUGS = new Set(["equipe", "aparencia", "ia"]);

export function sectionFromSlug(slug: string): AppSection | undefined {
  return SLUG_TO_SECTION[slug];
}

export function postsTabFromSlug(slug: string): PostsWorkTab | undefined {
  return SLUG_TO_POSTS_TAB[slug];
}

export function catalogTabFromSlug(slug: string): CatalogTab | undefined {
  return SLUG_TO_CATALOG_TAB[slug];
}

export function settingsTabFromSlug(slug: string): SettingsTab | undefined {
  return SLUG_TO_SETTINGS_TAB[slug];
}

export function accountTabFromSlug(slug: string): AccountTab | undefined {
  return SLUG_TO_ACCOUNT_TAB[slug];
}

export function defaultPostsTab(): PostsWorkTab {
  return "day";
}

export function defaultCatalogTab(): CatalogTab {
  return "references";
}

export function defaultSettingsTab(): SettingsTab {
  return "brand";
}

export function defaultAccountTab(): AccountTab {
  return "appearance";
}
