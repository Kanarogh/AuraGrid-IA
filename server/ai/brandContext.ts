/** Blocos de prompt derivados do Gem (estilo Gemini) + rodapé fixo das legendas */

export type RepeatingTextConfig = {
  structure?: string;
  address?: string;
  contact?: string;
  hashtags?: string;
  extra?: string;
  customFields?: {
    id: string;
    label: string;
    text: string;
    after: string;
  }[];
};

export type BrandGemConfig = {
  id?: string;
  name?: string;
  description?: string;
  instructions?: string;
  campaignContext?: string;
  footer?: RepeatingTextConfig;
  captionParams?: {
    maxTotalChars?: number;
    maxHookChars?: number;
    maxHookSentences?: number;
    emojiPolicy?: string;
    hookStyle?: string;
    includeReferenceWhenMatched?: boolean;
    avoidPriceMention?: boolean;
    salesTone?: string;
  };
};

export type BrandGemRequiredField =
  | "name"
  | "description"
  | "instructions"
  | "footer.address"
  | "footer.contact"
  | "footer.hashtags";

const REQUIRED_FIELD_LABELS: Record<BrandGemRequiredField, string> = {
  name: "Nome",
  description: "Descrição",
  instructions: "Instruções (tom)",
  "footer.address": "Endereço",
  "footer.contact": "Contato",
  "footer.hashtags": "Hashtags",
};

function filled(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

export function getMissingBrandGemFields(gem?: BrandGemConfig): BrandGemRequiredField[] {
  const missing: BrandGemRequiredField[] = [];
  if (!filled(gem?.name)) missing.push("name");
  if (!filled(gem?.description)) missing.push("description");
  if (!filled(gem?.instructions)) missing.push("instructions");
  if (!filled(gem?.footer?.address)) missing.push("footer.address");
  if (!filled(gem?.footer?.contact)) missing.push("footer.contact");
  if (!filled(gem?.footer?.hashtags)) missing.push("footer.hashtags");
  return missing;
}

export function assertBrandGemReadyForCaptions(gem?: BrandGemConfig): void {
  const missing = getMissingBrandGemFields(gem);
  if (missing.length === 0) return;
  const labels = missing.map((key) => REQUIRED_FIELD_LABELS[key]).join(", ");
  throw new Error(
    `Gem da marca incompleto. Preencha antes de gerar legendas: ${labels}.`
  );
}

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
      campaignContext: body.brandGem.campaignContext,
      footer: body.brandGem.footer ?? body.repeatingText,
      captionParams: body.brandGem.captionParams,
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
    return `BRAND VOICE: No GEM configured — do not invent tone, language, or brand personality.`;
  }

  const parts: string[] = [];
  if (name) parts.push(`GEM / CLIENT NAME: ${name}`);
  if (description) parts.push(`DESCRIPTION (role & scope):\n${description}`);
  if (instructions) {
    parts.push(
      `INSTRUCTIONS — TONE, LANGUAGE, STYLE (HIGHEST PRIORITY — MUST FOLLOW EXACTLY):\n---\n${instructions}\n---\n` +
        `The caption MUST use the language, tone, voice, audience, and sales style defined above. Do NOT default to Spanish or any other language unless INSTRUCTIONS specify it.`
    );
  }

  return `BRAND VOICE AND WRITING RULES:\n${parts.join("\n\n")}`;
}

/** Briefing da coleção/campanha do planejamento atual (muda a cada mês). */
export function buildCampaignContextBlock(gem?: BrandGemConfig): string {
  const ctx = gem?.campaignContext?.trim();
  if (!ctx) return "";
  return (
    `CAMPAIGN & COLLECTION BRIEF (current planning cycle — seasonal theme, collection manifesto, naming ideas, emotional hooks; complements but does NOT replace GEM INSTRUCTIONS):\n---\n${ctx}\n---\n` +
    `Use this brief for collection naming variations, seasonal angles, and desire-driven hooks in captions. Respect legal constraints mentioned here (e.g. avoid prohibited trademark names).`
  );
}

/** Estrutura fixa da legenda (layout padrão MIA / Instagram). */
export function buildCaptionStructureBlock(gem?: BrandGemConfig): string {
  const custom = gem?.footer?.structure?.trim();

  const rules = `CAPTION STRUCTURE — the app assembles blocks 2–6 from GEM footer. Your JSON "caption" field = block 1 ONLY.

Block order in the final post (blank line between each block):

1. MAIN HOOK (JSON "caption" field — you write ONLY this):
   Marketing text about the garment/look or image message.
   - Tone and language from GEM INSTRUCTIONS only.
   - Do NOT include hashtags, CTA, legal note, address, or "Referência" in the caption field.

2. REFERENCE LINE — added by system when matchedId is set:
   Referência: [exact catalog LABEL]

3. AI DISCLOSURE — added by system (verbatim from GEM footer):
   *Imagem gerada por inteligência artificial

4. ADDRESS — added by system if configured in GEM footer.

5. CALL TO ACTION — added by system (verbatim from GEM footer contact, starts with ➡️).

6. HASHTAGS — added by system (verbatim from GEM footer, last block).

EXAMPLE — what you put in JSON "caption" (block 1 only):
"""
O luxo encontra o conforto nessa modelagem acinturada com saia em camadas.
"""

EXAMPLE — full post after system assembly (do NOT put this in JSON caption):
"""
O luxo encontra o conforto nessa modelagem acinturada com saia em camadas.

Referência: Vestido Luxo com Bordados Neon — Leve e Acinturado-5073

*Imagem gerada por inteligência artificial

➡️ Acesse nosso site pelo link na Bio e acompanhe nossa coleção.

#Hashtag1 #Hashtag2 #Hashtag3
"""`;

  if (custom) {
    return `${rules}\n\nADDITIONAL STRUCTURE NOTES FROM CLIENT:\n${custom}`;
  }
  return rules;
}

function normalizeCaptionParams(gem?: BrandGemConfig) {
  const p = gem?.captionParams ?? {};
  return {
    maxHookChars: Math.min(1500, Math.max(80, p.maxHookChars ?? 500)),
    maxHookSentences: Math.min(4, Math.max(1, p.maxHookSentences ?? 2)),
    emojiPolicy: p.emojiPolicy ?? "minimal",
    hookStyle: p.hookStyle ?? "balanced",
    includeReferenceWhenMatched: p.includeReferenceWhenMatched !== false,
    avoidPriceMention: p.avoidPriceMention !== false,
    salesTone: p.salesTone ?? "balanced",
  };
}

export function buildCaptionParamsBlock(gem?: BrandGemConfig): string {
  const p = normalizeCaptionParams(gem);
  const emojiRules: Record<string, string> = {
    none: "Do NOT use emojis anywhere in the hook.",
    minimal: "Use at most 1 emoji in the hook, only if natural.",
    moderate: "Use emojis sparingly (1–3 in the hook).",
    free: "Emojis allowed if they fit the brand tone.",
  };
  const hookRules: Record<string, string> = {
    short: "Write exactly 1 punchy sentence for the hook.",
    balanced: "Write 1–2 sentences for the hook.",
    descriptive: "Write 1–2 sentences highlighting fabric, fit, and silhouette.",
  };
  const salesRules: Record<string, string> = {
    soft: "Hook tone: inspirational, elegant, no hard sell.",
    balanced: "Hook tone: warm and inviting with subtle call to desire.",
    direct: "Hook tone: clear benefit and urgency, still on-brand.",
  };

  return `CAPTION GENERATION PARAMETERS (mandatory — MAIN TEXT / hook only):
- The character limit applies ONLY to block 1 (main marketing hook). It does NOT include Referência, AI disclosure, address, ➡️ CTA, hashtags, or custom footer fields — those are fixed verbatim blocks appended separately.
- Max main text length: ${p.maxHookChars} characters (strict).
- Max main text sentences: ${p.maxHookSentences}.
- Full Instagram post may be up to 2200 characters including all fixed blocks.
- Write COMPLETE sentences within the limit — never end mid-word and never use "..." or ellipsis.
- Hook style: ${hookRules[p.hookStyle] ?? hookRules.balanced}
- Sales tone: ${salesRules[p.salesTone] ?? salesRules.balanced}
- Emojis: ${emojiRules[p.emojiPolicy] ?? emojiRules.minimal}
- Reference line: ${p.includeReferenceWhenMatched ? "Include when matchedId is set." : "Never include Referência line even if matched."}
- Prices: ${p.avoidPriceMention ? "Do NOT mention prices, discounts, or currency in the hook." : "Prices allowed if relevant to INSTRUCTIONS."}`;
}

export function buildRegenerationBlock(regenerate?: boolean): string {
  if (!regenerate) return "";
  return `
REGENERATION REQUEST (user clicked "Regenerate"):
- Write a COMPLETELY NEW main hook (block 1) — different wording, fresh angle, new adjectives.
- Do NOT reuse the same opening sentence or phrasing as a typical previous caption.
- Keep matchedId consistent if the garment match is still valid.
- Footer blocks (Referência label, disclosure, address, ➡️ CTA, hashtags) stay verbatim from GEM.`;
}

export type CaptionPromptOptions = {
  regenerate?: boolean;
  brief?: boolean;
  recentHooks?: string[];
};

function normalizeRecentHooks(raw?: string[]): string[] {
  if (!raw?.length) return [];
  const out: string[] = [];
  for (const hook of raw) {
    const trimmed = hook.trim();
    if (trimmed.length < 12) continue;
    if (out.some((h) => h.toLowerCase() === trimmed.toLowerCase())) continue;
    out.push(trimmed);
    if (out.length >= 8) break;
  }
  return out;
}

/** Evita ganchos repetidos dentro do post e entre posts do roteiro. */
export function buildAntiRepetitionBlock(recentHooks?: string[]): string {
  const hooks = normalizeRecentHooks(recentHooks);
  const recentBlock =
    hooks.length > 0
      ? `

RECENT HOOKS ALREADY USED IN THIS ROTEIRO (do NOT copy — new opening, new angle, new vocabulary):
${hooks
  .map((hook, index) => {
    const preview = hook.length > 140 ? `${hook.slice(0, 140).trim()}…` : hook;
    return `${index + 1}. """${preview}"""`;
  })
  .join("\n")}
- Do not reuse these opening lines, sentence starters, or key adjective clusters.
- If a phrase above starts with "O luxo", "Descubra", "Aposte", etc., pick a different starter.`
      : "";

  return `ANTI-REPETITION RULES (mandatory — block 1 / main hook only):
- Write copy unique to THIS image and garment — not a generic template.
- Never repeat footer blocks in the hook (Referência, disclosure, address, ➡️ CTA, hashtags) — the app adds them verbatim.
- Do not repeat the same word or phrase twice inside the hook.
- Vary rhythm and structure: alternate short punchy lines vs descriptive lines across posts.${recentBlock}`;
}

export function buildCaptionFooterBlock(footer?: RepeatingTextConfig): string {
  const rt = footer ?? {};
  const lines: string[] = [];
  if (rt.address?.trim()) lines.push(`- Address: ${rt.address.trim()}`);
  if (rt.contact?.trim()) lines.push(`- Contact / CTA (start with ➡️): ${rt.contact.trim()}`);
  if (rt.hashtags?.trim()) lines.push(`- Hashtags (last block): ${rt.hashtags.trim()}`);
  if (rt.extra?.trim()) lines.push(`- AI disclosure / legal note: ${rt.extra.trim()}`);

  const customs = (rt.customFields ?? []).filter((f) => f?.text?.trim());
  for (const field of customs) {
    lines.push(
      `- Custom field "${field.label || field.id}" (insert ${field.after}, verbatim): ${field.text.trim()}`
    );
  }

  if (lines.length === 0) {
    return `MANDATORY CAPTION FOOTER: None configured — do not invent address, hashtags or legal notes unless INSTRUCTIONS require them.`;
  }

  return `MANDATORY CAPTION FOOTER (fixed blocks — copy verbatim, including custom fields):\n${lines.join("\n")}`;
}

/** Instruções completas para gerar legenda no match-and-generate */
export function buildMatchCaptionInstructions(
  gem?: BrandGemConfig,
  options?: CaptionPromptOptions
): string {
  const antiRepeat = buildAntiRepetitionBlock(options?.recentHooks);

  if (options?.brief) {
    return `${buildBrandVoiceBlock(gem)}

${buildCampaignContextBlock(gem)}

${buildCaptionParamsBlock(gem)}

${buildCaptionFooterBlock(gem?.footer)}

${antiRepeat}

${buildRegenerationBlock(options?.regenerate)}

CAPTION TASK:
- JSON "caption" = block 1 (main hook) ONLY.
- Follow GEM language/tone and caption parameters.
- System appends Referência, disclosure, address, CTA, hashtags.`;
  }

  return `${buildBrandVoiceBlock(gem)}

${buildCampaignContextBlock(gem)}

${buildCaptionParamsBlock(gem)}

${buildCaptionStructureBlock(gem)}

${buildCaptionFooterBlock(gem?.footer)}

${antiRepeat}

${buildRegenerationBlock(options?.regenerate)}

CAPTION TASK (after JSON catalog match):
- JSON "caption" = block 1 (main hook) ONLY — never include Referência, disclosure, address, ➡️ CTA, or hashtags.
- Respect CAPTION GENERATION PARAMETERS for the hook (length, sentences, emojis, tone).
- Language, tone, hooks, and sales style MUST come from GEM INSTRUCTIONS — never assume Spanish or any default.
- Set matchedId from catalog comparison; the system adds "Referência:" using the exact catalog label.
- Do NOT invent address, hashtags, or brand facts — fixed blocks come from GEM footer automatically.`;}

export function buildRefineCaptionPrompt(
  currentCaption: string,
  instructions: string,
  gem?: BrandGemConfig
): string {
  return `Refine this fashion Instagram caption for the brand configured below.

${buildBrandVoiceBlock(gem)}

${buildCampaignContextBlock(gem)}

${buildCaptionParamsBlock(gem)}

${buildCaptionStructureBlock(gem)}

${buildCaptionFooterBlock(gem?.footer)}

Preserve the caption structure and generation parameters.
The main hook is block 1; fixed footer blocks (Referência, disclosure, address, ➡️ CTA, hashtags) are reassembled by the system — edit block 1 unless the user asks to change footer text.
Apply the GEM instructions to every edit.

User refinement: "${instructions}"

Current caption (full assembled post):
"""
${currentCaption}
"""

Return ONLY the full revised caption as plain text with the same block order (blank line between blocks).
Do NOT wrap in quotes, code fences, or markdown blocks.`;
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
