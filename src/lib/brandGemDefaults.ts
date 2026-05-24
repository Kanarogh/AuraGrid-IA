import type { BrandGem, RepeatingText } from "../types";

export const EMPTY_REPEATING_TEXT: RepeatingText = {
  structure: "",
  address: "",
  contact: "",
  hashtags: "",
  extra: "",
};

/** Gem vazio — você preenche e salva no workspace do cliente. */
export function createEmptyBrandGem(id: string, displayName = ""): BrandGem {
  return {
    id,
    name: displayName.trim(),
    description: "",
    instructions: "",
    footer: { ...EMPTY_REPEATING_TEXT },
  };
}

const FACTORY_DESCRIPTION_RE =
  /^Assistente criativo para .+\. Configure nome, descrição e instruções no estilo Gem\.?$/;

/** Conteúdo gerado automaticamente ao criar cliente (antes vinha com texto Palak). */
export function isFactoryPlaceholderGem(gem: BrandGem, clientName: string): boolean {
  const desc = gem.description.trim();
  const instr = gem.instructions.trim();
  const factoryDesc =
    desc === `Assistente criativo para ${clientName.trim()}. Configure nome, descrição e instruções no estilo Gem.` ||
    (FACTORY_DESCRIPTION_RE.test(desc) && !instr);

  const legacyPalak =
    instr.includes("Palak Fashions") ||
    instr.includes("Estratega de Marketing y Director Creativo de Palak") ||
    desc.includes("Palak Fashions") ||
    desc.includes("moda indiana boho");

  const legacyFooter =
    gem.footer.address.includes("Cobo Calleja") ||
    gem.footer.hashtags.includes("#PalakModa");

  return factoryDesc || legacyPalak || (legacyFooter && !instr);
}

export function clearFactoryPlaceholderGem(gem: BrandGem, clientName: string): BrandGem {
  if (!isFactoryPlaceholderGem(gem, clientName)) return gem;
  const empty = createEmptyBrandGem(gem.id, clientName.trim() || gem.name);
  return { ...empty, name: gem.name.trim() || clientName.trim() || empty.name };
}
