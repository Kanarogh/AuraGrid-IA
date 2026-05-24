/** Blocos de prompt derivados do Gem (estilo Gemini) + rodapé fixo das legendas */

export type RepeatingTextConfig = {
  structure?: string;
  address?: string;
  contact?: string;
  hashtags?: string;
  extra?: string;
};

export type BrandGemConfig = {
  id?: string;
  name?: string;
  description?: string;
  instructions?: string;
  footer?: RepeatingTextConfig;
};

export function resolveBrandGemFromBody(body: {
  brandGem?: BrandGemConfig;
  promptContext?: string;
  repeatingText?: RepeatingTextConfig;
}): BrandGemConfig {
  if (body.brandGem) {
    return {
      id: body.brandGem.id,
      name: body.brandGem.name,
      description: body.brandGem.description,
      instructions: body.brandGem.instructions ?? body.promptContext,
      footer: body.brandGem.footer ?? body.repeatingText,
    };
  }
  return {
    instructions: body.promptContext,
    footer: body.repeatingText,
  };
}

export function buildBrandVoiceBlock(gem?: BrandGemConfig): string {
  const name = gem?.name?.trim();
  const description = gem?.description?.trim();
  const instructions = gem?.instructions?.trim();

  if (!name && !description && !instructions) {
    return `BRAND VOICE: Use only what the user configured in INSTRUCTIONS when present.`;
  }

  const parts: string[] = [];
  if (name) parts.push(`GEM / CLIENT NAME: ${name}`);
  if (description) parts.push(`DESCRIPTION (role & scope):\n${description}`);
  if (instructions) {
    parts.push(`INSTRUCTIONS (MUST FOLLOW — configured by the client):\n---\n${instructions}\n---`);
  }

  return `BRAND VOICE AND WRITING RULES:\n${parts.join("\n\n")}`;
}

/** Estrutura fixa da legenda + linha Referencia condicional (dados fixos). */
export function buildCaptionStructureBlock(gem?: BrandGemConfig): string {
  const custom = gem?.footer?.structure?.trim();

  const rules = `CAPTION STRUCTURE ("dados fixos" — follow this order):

1. MAIN BODY (top): Hook + description of what is in the post (language and tone per INSTRUCTIONS).

2. CATALOG REFERENCE LINE — CONDITIONAL (middle, only sometimes):
   - Include exactly one line: Referencia: [LABEL]
   - Use the matched catalog item's label (from matchedId). [LABEL] is the catalog reference code/name.
   - ADD this line ONLY when ALL are true:
     • matchedId is not null (a catalog match exists), AND
     • The image clearly shows a wearable garment: a dress, outfit on a person/model, or a product shot where the garment is the focus.
   - Place this line immediately AFTER the main body and BEFORE footer lines.
   - OMIT "Referencia: …" entirely when:
     • matchedId is null, OR
     • The image has no dress/outfit/clothing to tie to the catalog (e.g. scenery only, abstract graphic, text-only slide, flat lay without a clear garment reference, logo, or lifestyle photo with no visible catalog piece).

3. FOOTER (bottom): Address, contact, hashtags, and closing note — only from MANDATORY CAPTION ELEMENTS below (if configured).`;

  if (custom) {
    return `${rules}\n\nADDITIONAL STRUCTURE NOTES FROM CLIENT:\n${custom}`;
  }
  return rules;
}

export function buildCaptionFooterBlock(footer?: RepeatingTextConfig): string {
  const rt = footer ?? {};
  const lines: string[] = [];
  if (rt.address?.trim()) lines.push(`- Address: ${rt.address.trim()}`);
  if (rt.contact?.trim()) lines.push(`- Contact / CTA: ${rt.contact.trim()}`);
  if (rt.hashtags?.trim()) lines.push(`- Hashtags (include this set): ${rt.hashtags.trim()}`);
  if (rt.extra?.trim()) lines.push(`- Closing note: ${rt.extra.trim()}`);

  if (lines.length === 0) {
    return `MANDATORY CAPTION FOOTER: None configured — do not invent address, hashtags or legal notes unless INSTRUCTIONS require them.`;
  }

  return `MANDATORY CAPTION FOOTER (bottom of caption — do not replace with invented text):\n${lines.join("\n")}`;
}

/** Instruções completas para gerar legenda no match-and-generate */
export function buildMatchCaptionInstructions(gem?: BrandGemConfig): string {
  return `${buildBrandVoiceBlock(gem)}

${buildCaptionStructureBlock(gem)}

${buildCaptionFooterBlock(gem?.footer)}

CAPTION TASK:
- Write the full caption following CAPTION STRUCTURE above.
- Respect the conditional Referencia line: include it only for dress/outfit/person-with-garment posts with a valid matchedId; skip it for image-only posts without catalog clothing.
- Do NOT use a different tone, address, or hashtags than configured in the GEM and footer.`;
}

export function buildRefineCaptionPrompt(
  currentCaption: string,
  instructions: string,
  gem?: BrandGemConfig
): string {
  return `Refine this fashion Instagram caption for the brand configured below.

${buildBrandVoiceBlock(gem)}

${buildCaptionStructureBlock(gem)}

${buildCaptionFooterBlock(gem?.footer)}

Preserve the caption structure: main body, optional "Referencia: …" only if the post shows catalog clothing with a match, then footer lines.
Preserve address, contact, hashtags and closing note unless the user explicitly asks to change them.
Apply the GEM instructions to every edit.

User refinement: "${instructions}"

Current caption:
"""
${currentCaption}
"""

Return ONLY the full revised caption.`;
}

/** Compat: APIs antigas que enviam promptContext + repeatingText */
export function buildMatchCaptionInstructionsLegacy(
  promptContext?: string,
  repeatingText?: RepeatingTextConfig
): string {
  return buildMatchCaptionInstructions(
    resolveBrandGemFromBody({ promptContext, repeatingText })
  );
}

export function buildRefineCaptionPromptLegacy(
  currentCaption: string,
  userInstructions: string,
  promptContext?: string,
  repeatingText?: RepeatingTextConfig
): string {
  return buildRefineCaptionPrompt(
    currentCaption,
    userInstructions,
    resolveBrandGemFromBody({ promptContext, repeatingText })
  );
}
