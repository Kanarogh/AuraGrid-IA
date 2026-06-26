/**
 * Contratos de payload por operação de IA.
 */

import type { MatchGenerateInput } from "./types";

export type AiMatchOperation = "match-and-generate" | "match-reference";

export const MATCH_SHORTLIST_THRESHOLD = 18;
export const MATCH_SHORTLIST_TOP_K = 12;

export const STRICT_RANKER_MIN_SCORE = 82;
export const STRICT_RANKER_MIN_GAP = 20;

export type CatalogProfilePayload = {
  id: string;
  label: string;
  profile: Record<string, unknown>;
};

export function parseCatalogProfiles(raw: unknown): CatalogProfilePayload[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const profiles: CatalogProfilePayload[] = [];
  for (const item of raw) {
    if (!item?.id || !item?.label || !item?.profile) return null;
    profiles.push({
      id: String(item.id),
      label: String(item.label),
      profile: item.profile as Record<string, unknown>,
    });
  }
  return profiles;
}

export function sanitizeMatchOperationInput(
  operation: AiMatchOperation,
  input: MatchGenerateInput
): MatchGenerateInput {
  const imageOnly = !!input.captionFromImageOnly && operation === "match-and-generate";

  if (imageOnly) {
    return {
      postImage: input.postImage,
      brandGem: input.brandGem,
      promptContext: input.promptContext,
      repeatingText: input.repeatingText,
      regenerateCaption: input.regenerateCaption,
      recentHooks: input.recentHooks,
      diverseBatch: input.diverseBatch,
      captionFromImageOnly: true,
      matchOnly: false,
      catalogItems: undefined,
      catalogProfiles: undefined,
    };
  }

  const profiles = parseCatalogProfiles(input.catalogProfiles);
  if (!profiles?.length) {
    throw new Error(
      operation === "match-and-generate"
        ? "Catálogo não indexado. Indexe as referências (JSON) antes de gerar legendas."
        : "Catálogo não indexado. Indexe as referências antes de buscar no acervo."
    );
  }

  return {
    ...input,
    catalogItems: undefined,
    catalogProfiles: profiles,
    clientId: input.clientId,
    matchRankHint: undefined,
    sceneContext: undefined,
    postFingerprint: undefined,
    matchOnly: operation === "match-reference" ? true : input.matchOnly,
    captionFromImageOnly: imageOnly,
  };
}
