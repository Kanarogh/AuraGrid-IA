import {
  buildCampaignContextBlock,
  buildMatchCaptionInstructions,
  buildBrandVoiceBlock,
  type BrandGemConfig,
  type CaptionPromptOptions,
} from "./brandContext";
import {
  buildStrictMatchingRubric,
  compactProfileForMatch,
  ultraCompactProfileForMatch,
} from "./matchProfile";
import { countSimilarSiblings } from "./profileRanker";
import type { PostVisualFingerprint } from "./postFingerprint";
import { compactProfileForMatchJson } from "./catalogProfileV2";
import type { CaptionOnlyInput, MatchGenerateInput, MatchRankHint } from "./types";

function brandLabel(gem?: BrandGemConfig): string {
  return gem?.name?.trim() || "the configured brand";
}

export function buildCaptionPromptOptions(
  input: Pick<MatchGenerateInput, "regenerateCaption" | "recentHooks" | "sceneContext">,
  brief?: boolean
): CaptionPromptOptions {
  return {
    regenerate: !!input.regenerateCaption,
    brief,
    recentHooks: input.recentHooks,
    sceneContext: input.sceneContext,
  };
}

export type CatalogProfileCandidate = {
  id: string;
  label: string;
  profile?: Record<string, unknown>;
};

type CatalogPromptOptions = {
  ultraCompact?: boolean;
  brief?: boolean;
  matchRankHint?: MatchRankHint;
};

function buildSimilarSiblingWarning(profiles: CatalogProfileCandidate[]): string {
  const siblings = countSimilarSiblings(profiles);
  if (siblings < 2) return "";

  return `
⚠️ SIMILAR SIBLINGS DETECTED (${siblings}+ candidates share color family + garment type):
- Color and maxi length are NOT enough — you MUST match g.m (motif), g.l (layout), g.b (back).
- Compare tie-dye vs geometric vs floral — different SKUs in the same color line.
- Read g.not tokens for every top candidate.
- If motif or back differs → reject even if color matches.
- Require gap ≥22 and ≥6 confirmed g.a anchors before setting matchedId.
- sc (scene) is NOT for SKU match — garment fields only.`;
}

export function buildMatchRankHintBlock(hint?: MatchRankHint): string {
  if (!hint) return "";
  return `
FINGERPRINT PRE-RANK (starting point only — does NOT bypass strict protocol):
- Automatic top candidate: id "${hint.candidateId}" → label "${hint.candidateLabel}"
- Pre-rank score ${hint.score}/100, gap vs 2nd: ${hint.scoreGap}
- You MUST still apply STRICT MATCHING PROTOCOL (score ≥82, gap ≥20, patternMotif must match, zero contradictions).
- Set matchedId ONLY if this candidate satisfies ALL Phase 3 decision rules after your own visual scoring.
- Pre-rank below 82 means matchedId stays null unless your field-by-field score reaches ≥82 with clear print/back match.`;
}

/** Bloco JSON enviado à IA — comparação visual via perfis indexados (sem fotos do catálogo). */
export function buildCatalogProfilesPromptSection(
  profiles: CatalogProfileCandidate[],
  options?: CatalogPromptOptions
): string {
  const toProfile = options?.ultraCompact ? ultraCompactProfileForMatch : compactProfileForMatch;
  const candidates = profiles.map((p) => toProfile(p.id, p.label, p.profile));
  const profilesJson = JSON.stringify(candidates);
  const rankHint = buildMatchRankHintBlock(options?.matchRankHint);
  const siblingWarning = buildSimilarSiblingWarning(profiles);

  if (options?.brief) {
    const labelMap = profiles
      .map((p) => `  • id "${p.id}" → Referência label: "${p.label}"`)
      .join("\n");

    return `${buildStrictMatchingRubric()}
${rankHint}${siblingWarning}

CANDIDATE PROFILES (${candidates.length} — v2: g=garment, sc=scene):
${profilesJson}

ID → LABEL MAP (matchedId = catalog id only; app adds "Referência: [label]" when matchedId is set):
${labelMap}

Match conservatively (score ≥82, gap ≥20, patternMotif + backDetail required). When you accept the match, matchedId MUST be the candidate id — if null, Referência will not appear. reasoning in Portuguese with top-2 scores.`;
  }

  const labelMap = profiles
    .map((p) => `  • id "${p.id}" → Referência label: "${p.label}"`)
    .join("\n");

  return `${buildStrictMatchingRubric()}${siblingWarning}

CANDIDATE CATALOG PROFILES (${candidates.length} items — compact discriminative JSON):

${profilesJson}

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
  options?: CaptionPromptOptions
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
  candidates: Array<{ id: string; label?: string }>
): string | null {
  const normalized = normalizeMatchedId(matchedId);
  if (!normalized) return null;

  const ids = candidates.map((c) => c.id);
  if (ids.includes(normalized)) return normalized;

  const lower = normalized.toLowerCase();
  const exactLabel = candidates.find(
    (c) => c.label?.trim() && c.label.trim().toLowerCase() === lower
  );
  if (exactLabel) return exactLabel.id;

  const partialLabel = candidates.find((c) => {
    const label = c.label?.trim().toLowerCase();
    if (!label || label.length < 8) return false;
    return label.includes(lower) || lower.includes(label.slice(0, 24));
  });
  if (partialLabel) return partialLabel.id;

  return null;
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

${buildCampaignContextBlock(gem)}

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

/** Legenda com imagem — sem match nem JSON de catálogo. */
export function buildCaptionOnlyTask(input: CaptionOnlyInput, gem?: BrandGemConfig): string {
  const refLine = input.matchedCatalogLabel
    ? `\nMatched catalog reference (for tone/context only, do NOT write "Referência:" in caption): "${input.matchedCatalogLabel}"`
    : "";

  return `${buildBrandVoiceBlock(gem)}

${buildCampaignContextBlock(gem)}

You are an expert social media copywriter for "${brandLabel(gem)}".

TASK — CAPTION ONLY (match already decided):
1. Inspect the TARGET POST IMAGE.
2. Write block 1 (main hook) per BRAND GEM rules below.
3. Do NOT perform catalog matching — matchedId is not part of this step.${refLine}

TARGET POST IMAGE:`;
}

export function buildCaptionOnlyResultInstructions(
  gem: Parameters<typeof buildMatchCaptionInstructions>[0],
  options?: CaptionPromptOptions
): string {
  return `${buildMatchCaptionInstructions(gem, options)}

CAPTION-ONLY MODE:
- Output JSON only: { "caption": string }
- caption = block 1 (main hook) ONLY — no Referência, disclosure, address, ➡️ CTA, or hashtags.`;
}

function serializePostFingerprint(fp: PostVisualFingerprint): Record<string, unknown> {
  return {
    garment: fp.garment ?? {
      type: fp.garmentType,
      colors: fp.primaryColors,
      motif: fp.patternMotif,
      layout: fp.patternLayout,
      scale: fp.printScale,
      back: fp.backDetail,
      neck: fp.neckline,
      sleeve: fp.sleeves,
      len: fp.dressLength,
      skirt: fp.skirtConstruction,
      sil: fp.silhouette,
      anchors: fp.visibleAnchors,
    },
    scene: fp.scene,
  };
}

export function buildFingerprintMatchSection(
  fingerprint: PostVisualFingerprint,
  profiles: CatalogProfileCandidate[],
  options?: CatalogPromptOptions
): string {
  const toProfile = options?.ultraCompact ? ultraCompactProfileForMatch : compactProfileForMatch;
  const candidates = profiles.map((p) => toProfile(p.id, p.label, p.profile));
  const fpJson = JSON.stringify(serializePostFingerprint(fingerprint));
  const profilesJson = JSON.stringify(candidates);
  const rankHint = buildMatchRankHintBlock(options?.matchRankHint);
  const siblingWarning = buildSimilarSiblingWarning(profiles);
  const labelMap = profiles
    .map((p) => `  • id "${p.id}" → Referência label: "${p.label}"`)
    .join("\n");

  return `${buildStrictMatchingRubric()}
${rankHint}${siblingWarning}

POST FINGERPRINT (from prior vision step — NO post image in this request):
${fpJson}

CANDIDATE CATALOG PROFILES (${candidates.length} — v2: g=garment, sc=scene):
${profilesJson}

ID → LABEL MAP:
${labelMap}

Compare fingerprint garment fields to each candidate g.* — scene (sc) is caption context only.`;
}

export function buildFingerprintMatchTask(matchOnly: boolean, gem?: BrandGemConfig): string {
  const step = matchOnly
    ? "Return ONLY the catalog match (no caption)."
    : "After matching, write block 1 caption per GEM rules (no Referência line in caption).";

  const gemPrefix = matchOnly
    ? ""
    : `${buildBrandVoiceBlock(gem)}

`;

  return `${gemPrefix}You are an expert fashion catalog matcher for "${brandLabel(gem)}".

TASK (fingerprint JSON mode — TEXT ONLY, no post image):
1. Use POST FINGERPRINT JSON as the visual ground truth for the target post.
2. Apply STRICT MATCHING PROTOCOL when scoring candidates.
3. ${step}

OUTPUT: JSON only. reasoning in Portuguese with top-2 scores.`;
}

export function buildImageOnlyResultInstructions(
  gem: Parameters<typeof buildMatchCaptionInstructions>[0],
  options?: CaptionPromptOptions
): string {
  return `${buildMatchCaptionInstructions(gem, options)}

IMAGE-ONLY MODE (mandatory):
- matchedId: always null — do NOT match catalog.
- reasoning: Portuguese, 2-4 sentences describing what you read and saw in the image (text, design, campaign message).
- caption: block 1 (main hook) ONLY — marketing text inspired by the image; no Referência, no footer blocks.

Output JSON only: { "matchedId": null, "reasoning": string, "caption": string }`;
}
