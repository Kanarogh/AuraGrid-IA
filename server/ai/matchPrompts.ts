import { buildMatchCaptionInstructions, buildBrandVoiceBlock, type BrandGemConfig } from "./brandContext.ts";
import { buildStrictMatchingRubric, compactProfileForMatch } from "./matchProfile.ts";

function brandLabel(gem?: BrandGemConfig): string {
  return gem?.name?.trim() || "the configured brand";
}

export type CatalogProfileCandidate = {
  id: string;
  label: string;
  profile?: Record<string, unknown>;
};

/** Bloco JSON enviado à IA — comparação visual via perfis indexados (sem fotos do catálogo). */
export function buildCatalogProfilesPromptSection(profiles: CatalogProfileCandidate[]): string {
  const candidates = profiles.map((p) =>
    compactProfileForMatch(p.id, p.label, p.profile)
  );

  const labelMap = profiles
    .map((p) => `  • id "${p.id}" → Referência label: "${p.label}"`)
    .join("\n");

  return `${buildStrictMatchingRubric()}

CANDIDATE CATALOG PROFILES (${candidates.length} items — compact discriminative JSON):

${JSON.stringify(candidates, null, 2)}

ID → LABEL MAP (when matchedId is set, use the EXACT label above in "Referência: …"):
${labelMap}

In your reasoning (Portuguese), briefly state: top-2 candidate scores, which matchAnchors matched, and why you accepted or rejected the match.`;
}

export function buildMatchJsonCatalogTask(matchOnly: boolean, gem?: BrandGemConfig): string {
  const step4 = matchOnly
    ? "Return ONLY the catalog match (no caption, no social media text)."
    : "After matching, write the full caption using the BRAND GEM rules below (tone, language, footer).";

  const gemPrefix = matchOnly
    ? ""
    : `${buildBrandVoiceBlock(gem)}

`;

  return `${gemPrefix}You are an expert AI fashion catalog matcher for "${brandLabel(gem)}".

TASK (catalog JSON mode — post image + indexed profiles only):
1. Inspect the TARGET POST IMAGE below with maximum detail (colors, print scale, neckline, sleeves, length).
2. Apply STRICT MATCHING PROTOCOL from Phase 1–3 when scoring candidates.
3. Compare against CANDIDATE CATALOG PROFILES (JSON) — field-by-field, conservative scoring.
4. Pick matchedId ONLY when decision rules are fully satisfied; otherwise null.
5. ${step4}

OUTPUT RULES:
- reasoning: Portuguese, 3–5 sentences — include top scores, confirmed matchAnchors, and why match was accepted/rejected.
- matchedId: exact candidate id or null (never invent ids).
${matchOnly ? "" : "- caption: block 1 (main hook) ONLY per GEM rules below.\n"}

TARGET POST IMAGE:`;
}

export function buildMatchImagesCatalogTask(matchOnly: boolean, gem?: BrandGemConfig): string {
  const brand = brandLabel(gem);

  if (matchOnly) {
    return `You are an expert fashion planner for "${brand}".
Compare the query image to candidate catalog photos. Pick matchedId or null. Do NOT write any caption.

Target query image:`;
  }

  return `You are an expert fashion planner and copywriter for "${brand}".
Compare the target post image to candidate catalog photos. Pick matchedId or null.
Write the caption using the BRAND GEM tone, language, and footer rules below (do NOT assume Spanish).

Target post image:`;
}

export function buildMatchResultInstructions(
  gem: Parameters<typeof buildMatchCaptionInstructions>[0],
  matchOnly: boolean,
  options?: { regenerate?: boolean }
): string {
  if (matchOnly) {
    return `MATCH ONLY — identify the catalog reference with maximum precision. Do not generate captions.

${buildStrictMatchingRubric()}

Output JSON only: { "matchedId": string|null, "reasoning": string (Portuguese, include scores + matchAnchors) }`;
  }

  return `${buildMatchCaptionInstructions(gem, options)}

Output JSON only: { "matchedId": string|null, "reasoning": string (Portuguese), "caption": string }
- "caption" = block 1 (main hook) ONLY — no Referência, disclosure, address, ➡️ CTA, or hashtags.`;
}

export const MATCH_RESPONSE_HINT = `RESPOND WITH PURE JSON ONLY (no prose, no markdown fences). The JSON must follow:
{
  "matchedId": "string-or-null",
  "reasoning": "...",
  "caption": "main hook text only — block 1, no footer blocks"
}`;

export const MATCH_REFERENCE_RESPONSE_HINT = `RESPOND WITH PURE JSON ONLY (no prose, no markdown fences). The JSON must follow:
{
  "matchedId": "string-or-null",
  "reasoning": "..."
}`;

export function normalizeMatchedId(mid: string | null | undefined): string | null {
  if (!mid || mid === "null" || mid === "none" || String(mid).trim() === "") return null;
  return mid;
}

/** Rejeita ids alucinados — só aceita ids presentes nos candidatos. */
export function resolveMatchedIdFromCandidates(
  matchedId: string | null | undefined,
  candidateIds: string[]
): string | null {
  const normalized = normalizeMatchedId(matchedId);
  if (!normalized) return null;
  return candidateIds.includes(normalized) ? normalized : null;
}

export function isImageOnlyCaptionMode(input: {
  captionFromImageOnly?: boolean;
  matchOnly?: boolean;
}): boolean {
  return !!input.captionFromImageOnly && !input.matchOnly;
}

/** Prompt quando a imagem é arte/banner — sem comparar catálogo de vestidos. */
export function buildImageOnlyCaptionTask(gem?: BrandGemConfig): string {
  return `${buildBrandVoiceBlock(gem)}

You are an expert social media copywriter for "${brandLabel(gem)}".

TASK (image-only mode — NO catalog matching):
1. Inspect the TARGET POST IMAGE carefully.
2. Read ALL visible text in the image (headlines, collection names, slogans, offers, dates, CTAs, etc.).
3. Note colors, layout, mood, and the marketing message the graphic communicates.
4. Write a full Instagram/Facebook caption inspired by what is IN THE IMAGE.

IMPORTANT:
- This image may be a graphic, banner, or artwork with text — NOT necessarily a product/dress photo.
- Do NOT invent a catalog garment reference or "Referência:" line.
- Base the hook and message on the text and visuals shown in the image.
- matchedId MUST be null.

TARGET POST IMAGE:`;
}

export function buildImageOnlyResultInstructions(
  gem: Parameters<typeof buildMatchCaptionInstructions>[0],
  options?: { regenerate?: boolean }
): string {
  return `${buildMatchCaptionInstructions(gem, options)}

IMAGE-ONLY MODE (mandatory):
- matchedId: always null — do NOT match catalog.
- reasoning: Portuguese, 2-4 sentences describing what you read and saw in the image (text, design, campaign message).
- caption: block 1 (main hook) ONLY — marketing text inspired by the image; no Referência, no footer blocks.

Output JSON only: { "matchedId": null, "reasoning": string, "caption": string }`;
}
