import { normalizeCatalogItem } from "../catalog";
import { loadBrandGem } from "../brandGem";
import { createEmptyBrandGem } from "../brandGemDefaults";
import {
  PRELOADED_CATALOG,
  PRELOADED_POSTS,
} from "../../data/preloaded";
import { recalculatePostDates } from "../dates";
import type { CatalogItem, CanvaGridPage, PlannedPost } from "../../types";
import { createDefaultPlanningPeriod, defaultPlanningStartDate } from "../planningConstants";
import { createClientMeta, createDefaultCanvaPages, createEmptyWorkspace } from "./factory";
import { loadRegistry, loadWorkspace, saveRegistry, saveWorkspace } from "./storage";
import type { ClientRegistry, ClientWorkspace } from "./types";

const LEGACY_PALAK_ID = "palak-euro";

export function createEmptyRegistry(): ClientRegistry {
  return { version: 1, activeClientId: "", clients: [] };
}

function readLegacyCanvaPages(): CanvaGridPage[] {
  try {
    const saved = localStorage.getItem("palak_canva_pages");
    if (saved) return JSON.parse(saved) as CanvaGridPage[];
  } catch {
    /* ignore */
  }
  const pages = createDefaultCanvaPages();
  const defaultCatalog = PRELOADED_CATALOG;
  if (defaultCatalog.length > 0) {
    for (let i = 0; i < Math.min(12, defaultCatalog.length); i++) {
      const slotIdx = 11 - i;
      pages[0].slots[slotIdx].image = defaultCatalog[i].image;
      pages[0].slots[slotIdx].label = defaultCatalog[i].label;
      pages[0].slots[slotIdx].matchedCatalogId = defaultCatalog[i].id;
    }
  }
  return pages;
}

function buildLegacyWorkspace(): ClientWorkspace {
  const startDate = localStorage.getItem("palak_start_date") || defaultPlanningStartDate();

  let catalog: CatalogItem[] = PRELOADED_CATALOG;
  try {
    const saved = localStorage.getItem("palak_catalog");
    if (saved) catalog = JSON.parse(saved) as CatalogItem[];
  } catch {
    /* ignore */
  }
  catalog = catalog.map(normalizeCatalogItem);

  let posts: PlannedPost[] = PRELOADED_POSTS;
  try {
    const saved = localStorage.getItem("palak_posts");
    if (saved) posts = JSON.parse(saved) as PlannedPost[];
  } catch {
    /* ignore */
  }
  posts = recalculatePostDates(startDate, posts);

  const brandGem = loadBrandGem();
  if (brandGem.id !== LEGACY_PALAK_ID) {
    brandGem.id = LEGACY_PALAK_ID;
  }

  const autoSync = localStorage.getItem("palak_auto_sync_canva") !== "false";
  const reversed = localStorage.getItem("palak_canva_reversed") !== "false";
  const activePageId =
    localStorage.getItem("palak_active_canva_page_id") || "page_1";

  const defaultPeriod = createDefaultPlanningPeriod(LEGACY_PALAK_ID, startDate);

  return {
    version: 1,
    brandGem: brandGem.name ? brandGem : createEmptyBrandGem(LEGACY_PALAK_ID, "Palak"),
    catalog,
    posts,
    contentSchedule: [],
    startDate,
    activePlanningPeriodId: defaultPeriod.id,
    planningPeriods: [defaultPeriod],
    isReadOnly: false,
    canva: {
      pages: readLegacyCanvaPages(),
      activePageId,
      autoSync,
      reversed,
    },
    ui: {
      activeSection: "posts",
      activePreviewId: "post_day1",
      viewMode: "split",
    },
  };
}

function hasLegacyData(): boolean {
  return (
    !!localStorage.getItem("palak_catalog") ||
    !!localStorage.getItem("palak_posts") ||
    !!localStorage.getItem("auragrid_brand_gem") ||
    !!localStorage.getItem("palak_context")
  );
}

/** Executa migração única se necessário; retorna registry pronto. */
function repairRegistry(registry: ClientRegistry): ClientRegistry {
  let repaired = { ...registry };
  if (!repaired.clients.length) {
    const empty = createEmptyRegistry();
    saveRegistry(empty);
    return empty;
  }
  if (!repaired.clients.some((c) => c.id === repaired.activeClientId)) {
    repaired.activeClientId = repaired.clients[0]!.id;
  }
  for (const client of repaired.clients) {
    const ws = loadWorkspace(client.id, client);
    if (!ws?.canva?.pages?.length) {
      saveWorkspace(client.id, createEmptyWorkspace(client));
    }
  }
  saveRegistry(repaired);
  return repaired;
}

export function ensureClientRegistry(): ClientRegistry {
  const existing = loadRegistry();
  if (existing) {
    if (existing.clients.length === 0) return existing;
    return repairRegistry(existing);
  }

  if (hasLegacyData()) {
    const meta = createClientMeta(LEGACY_PALAK_ID, "Palak");
    const workspace = buildLegacyWorkspace();
    workspace.brandGem.id = LEGACY_PALAK_ID;
    saveWorkspace(LEGACY_PALAK_ID, workspace);
    const registry: ClientRegistry = {
      version: 1,
      activeClientId: LEGACY_PALAK_ID,
      clients: [meta],
    };
    saveRegistry(registry);
    console.info(
      "[AuraGrid] Dados migrados para o cliente «%s». Chaves antigas palak_* mantidas como backup.",
      meta.name
    );
    return registry;
  }

  const empty = createEmptyRegistry();
  saveRegistry(empty);
  return empty;
}
