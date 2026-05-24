/** Blocos de prompt derivados do Gem (estilo Gemini) + rodapé fixo das legendas */

export type RepeatingTextConfig = {
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
    return `BRAND VOICE: Boutique mayorista de moda india "Palak" (Madrid). Legendas en español, tono sofisticado, cálido y estético para Instagram.`;
  }

  const parts: string[] = [];
  if (name) parts.push(`GEM / CLIENT NAME: ${name}`);
  if (description) parts.push(`DESCRIPTION (role & scope):\n${description}`);
  if (instructions) {
    parts.push(`INSTRUCTIONS (MUST FOLLOW — configured by the client):\n---\n${instructions}\n---`);
  }

  return `BRAND VOICE AND WRITING RULES:\n${parts.join("\n\n")}`;
}

export function buildCaptionFooterBlock(footer?: RepeatingTextConfig): string {
  const rt = footer ?? {};
  return `MANDATORY CAPTION ELEMENTS (use in the Spanish caption — do not replace with invented text):
- Address: ${rt.address || "Calle Manuel Cobo Calleja, 46 Local 5, Madrid"}
- Contact / CTA: ${rt.contact || "Contacta vía WhatsApp en el enlace de la biografía"}
- Hashtags (include this set): ${rt.hashtags || "#PalakModa #ModaIndia #BoutiqueMadrid"}
- Closing note: ${rt.extra || "*Imagen creada con inteligencia artificial"}`;
}

/** Instruções completas para gerar legenda no match-and-generate */
export function buildMatchCaptionInstructions(gem?: BrandGemConfig): string {
  return `${buildBrandVoiceBlock(gem)}

${buildCaptionFooterBlock(gem?.footer)}

CAPTION TASK (Spanish only):
- Write for the brand described in the GEM above (wholesale + premium Instagram aesthetic).
- Opening hook, outfit description aligned with INSTRUCTIONS.
- Line on its own: Referencia: [LABEL] (use the matched catalog label).
- Naturally include address, contact, hashtags, and closing note from MANDATORY CAPTION ELEMENTS.
- Do NOT use a different tone, address, or hashtags than configured above.`;
}

export function buildRefineCaptionPrompt(
  currentCaption: string,
  instructions: string,
  gem?: BrandGemConfig
): string {
  return `Refine this Spanish fashion Instagram caption for the brand configured below.

${buildBrandVoiceBlock(gem)}

${buildCaptionFooterBlock(gem?.footer)}

Preserve address, contact, hashtags and closing note unless the user explicitly asks to change them.
Apply the GEM instructions to every edit.

User refinement: "${instructions}"

Current caption:
"""
${currentCaption}
"""

Return ONLY the full revised caption in Spanish.`;
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
