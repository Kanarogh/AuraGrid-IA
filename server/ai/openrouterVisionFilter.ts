/**
 * Modelos que a API OpenRouter lista com entrada "image" mas não servem
 * para chat/JSON de catálogo (áudio, geração de mídia, etc.).
 */
const EXCLUDED_ID_PATTERNS = [
  /lyria/i,
  /imagen/i,
  /dall-?e/i,
  /stable-diffusion/i,
  /\bflux\b/i,
  /musicgen/i,
  /audio-preview/i,
  /-clip-preview/i,
  /-pro-preview$/i,
  /suno/i,
  /elevenlabs/i,
];

export function isOpenRouterCatalogVisionModelId(id: string): boolean {
  const normalized = id.trim().toLowerCase();
  if (!normalized) return false;
  return !EXCLUDED_ID_PATTERNS.some((re) => re.test(normalized));
}

/** Ordem preferida na cadeia live (Gemma 4 → Qwen VL → resto → roteador). */
export function sortOpenRouterVisionModelIds(ids: string[]): string[] {
  const score = (id: string): number => {
    if (/gemma-4-31b/i.test(id)) return 0;
    if (/gemma-4-26b/i.test(id)) return 1;
    if (/gemma-4/i.test(id)) return 2;
    if (/qwen.*vl/i.test(id)) return 3;
    if (/nemotron.*vl/i.test(id)) return 4;
    if (id === "openrouter/free") return 100;
    return 50;
  };
  return [...ids].sort((a, b) => score(a) - score(b));
}

export function filterOpenRouterCatalogVisionModelIds(ids: string[]): string[] {
  return sortOpenRouterVisionModelIds(
    ids.filter((id) => isOpenRouterCatalogVisionModelId(id))
  );
}
