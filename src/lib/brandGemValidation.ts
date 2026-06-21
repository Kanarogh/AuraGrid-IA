import type { BrandGem } from "../types";

export type BrandGemFieldKey =
  | "name"
  | "description"
  | "instructions"
  | "footer.address"
  | "footer.contact"
  | "footer.hashtags";

const FIELD_LABELS: Record<BrandGemFieldKey, string> = {
  name: "Nome",
  description: "Descrição",
  instructions: "Instruções (tom)",
  "footer.address": "Endereço",
  "footer.contact": "Contato",
  "footer.hashtags": "Hashtags",
};

/** Campos obrigatórios para gerar legendas (endereço é opcional). */
export const REQUIRED_BRAND_GEM_FIELD_COUNT = 5;

function isFilled(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

/** Campos obrigatórios antes de gerar ou refinar legendas com IA. */
export function getMissingBrandGemFields(gem: BrandGem): BrandGemFieldKey[] {
  const missing: BrandGemFieldKey[] = [];
  if (!isFilled(gem.name)) missing.push("name");
  if (!isFilled(gem.description)) missing.push("description");
  if (!isFilled(gem.instructions)) missing.push("instructions");
  if (!isFilled(gem.footer.contact)) missing.push("footer.contact");
  if (!isFilled(gem.footer.hashtags)) missing.push("footer.hashtags");
  return missing;
}

export function isBrandGemReadyForCaptions(gem: BrandGem): boolean {
  return getMissingBrandGemFields(gem).length === 0;
}

export function brandGemFieldLabel(key: BrandGemFieldKey): string {
  return FIELD_LABELS[key];
}

export function formatMissingBrandGemFields(gem: BrandGem): string {
  const missing = getMissingBrandGemFields(gem);
  if (missing.length === 0) return "";
  return missing.map(brandGemFieldLabel).join(", ");
}

export function brandGemRequiredMessage(gem: BrandGem): string {
  const list = formatMissingBrandGemFields(gem);
  if (!list) return "";
  return `Configure o Gem da marca antes de gerar legendas. Campos pendentes: ${list}. Abra Configurações e preencha todos os campos obrigatórios.`;
}
