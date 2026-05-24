import { DEFAULT_BRAND_GEM } from "../data/preloaded";
import type { BrandGem } from "../types";

const STORAGE_KEY = "auragrid_brand_gem";
const LEGACY_CONTEXT_KEY = "palak_context";
const LEGACY_REPEATING_KEY = "palak_repeating";

/** @deprecated Gem vive no workspace do cliente — use ClientWorkspaceContext */
export function loadBrandGem(): BrandGem {
  if (typeof window === "undefined") return DEFAULT_BRAND_GEM;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<BrandGem>;
      return normalizeBrandGem(parsed);
    }
  } catch {
    /* migra abaixo */
  }

  return migrateLegacyBrandGem();
}

function migrateLegacyBrandGem(): BrandGem {
  const gem = { ...DEFAULT_BRAND_GEM };

  try {
    const legacyContext = window.localStorage.getItem(LEGACY_CONTEXT_KEY);
    if (legacyContext?.trim()) {
      gem.instructions = legacyContext.trim();
    }
    const legacyRepeating = window.localStorage.getItem(LEGACY_REPEATING_KEY);
    if (legacyRepeating) {
      gem.footer = { ...gem.footer, ...JSON.parse(legacyRepeating) };
    }
  } catch {
    /* defaults */
  }

  saveBrandGem(gem);
  return gem;
}

function normalizeBrandGem(partial: Partial<BrandGem>): BrandGem {
  return {
    id: partial.id?.trim() || DEFAULT_BRAND_GEM.id,
    name: partial.name?.trim() || DEFAULT_BRAND_GEM.name,
    description: partial.description?.trim() ?? DEFAULT_BRAND_GEM.description,
    instructions: partial.instructions?.trim() || DEFAULT_BRAND_GEM.instructions,
    footer: {
      ...DEFAULT_BRAND_GEM.footer,
      ...(partial.footer ?? {}),
    },
  };
}

/** @deprecated Gem vive no workspace do cliente — use ClientWorkspaceContext */
export function saveBrandGem(gem: BrandGem): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeBrandGem(gem)));
}

export function gemInitial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.charAt(0).toUpperCase();
}
