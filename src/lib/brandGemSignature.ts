import type { BrandGem } from "../types";
import { normalizeCaptionCustomFields } from "./captionFields";
import { normalizeCaptionGenerationParams } from "./captionParams";
/** Assinatura estável para comparar se o Gem mudou (ignora id). */
export function brandGemSignature(gem: BrandGem): string {
  return JSON.stringify({
    name: gem.name.trim(),
    description: gem.description.trim(),
    instructions: gem.instructions.trim(),
    campaignContext: (gem.campaignContext ?? "").trim(),
    captionParams: normalizeCaptionGenerationParams(gem.captionParams),
    footer: {
      structure: gem.footer.structure?.trim() ?? "",
      address: gem.footer.address.trim(),
      contact: gem.footer.contact.trim(),
      hashtags: gem.footer.hashtags.trim(),
      extra: gem.footer.extra.trim(),
      customFields: normalizeCaptionCustomFields(gem.footer.customFields),
    },
  });
}
