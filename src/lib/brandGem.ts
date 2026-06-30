import { createEmptyBrandGem } from "./brandGemDefaults";
import { normalizeCaptionGenerationParams } from "./captionParams";
import type { BrandGem } from "../types";
import { STORAGE } from "./storageLegacy";

const STORAGE_KEY = STORAGE.brandGem;
const LEGACY_CONTEXT_KEY = "palak_context";
const LEGACY_REPEATING_KEY = "palak_repeating";

/** @deprecated Gem vive no workspace do cliente — use ClientWorkspaceContext */
export function loadBrandGem(): BrandGem {
  if (typeof window === "undefined") return createEmptyBrandGem("cliente");

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
  const gem = createEmptyBrandGem("cliente");

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
    /* vazio */
  }

  saveBrandGem(gem);
  return gem;
}

function normalizeBrandGem(partial: Partial<BrandGem>): BrandGem {
  const base = createEmptyBrandGem(partial.id?.trim() || "cliente", partial.name ?? "");
  return {
    id: partial.id?.trim() || base.id,
    name: partial.name?.trim() ?? "",
    description: partial.description?.trim() ?? "",
    instructions: partial.instructions?.trim() ?? "",
    captionParams: normalizeCaptionGenerationParams(
      partial.captionParams ?? base.captionParams
    ),
    footer: {      structure: partial.footer?.structure?.trim() ?? "",
      address: partial.footer?.address?.trim() ?? "",
      contact: partial.footer?.contact?.trim() ?? "",
      hashtags: partial.footer?.hashtags?.trim() ?? "",
      extra: partial.footer?.extra?.trim() ?? "",
      customFields: Array.isArray(partial.footer?.customFields)
        ? partial.footer.customFields
        : [],
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
