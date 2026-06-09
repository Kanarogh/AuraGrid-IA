import type { RepeatingText } from "../types";
import {
  type CaptionCustomField,
  type CaptionFieldAnchor,
  normalizeCaptionCustomFields,
} from "./captionFields";
import {
  type CaptionGenerationParams,
  INSTAGRAM_CAPTION_HARD_MAX,
  normalizeCaptionGenerationParams,
} from "./captionParams";
export type CaptionFooter = RepeatingText;

const DEFAULT_AI_DISCLOSURE = "*Imagem gerada por inteligência artificial";

export function resolveCatalogLabel(
  catalog: { id: string; label?: string }[],
  matchedCatalogId: string | null
): string | null {
  if (!matchedCatalogId) return null;
  const label = catalog.find((c) => c.id === matchedCatalogId)?.label?.trim();
  return label || null;
}

function ensureArrowCta(contact: string): string {
  const t = contact.trim();
  if (!t) return "";
  if (t.startsWith("➡️")) return t;
  if (t.startsWith("→")) return `➡️ ${t.slice(1).trim()}`;
  return `➡️ ${t}`;
}

function normalizeDisclosure(extra: string): string {
  let t = extra.trim().replace(/[\s\-–—.]+\s*$/u, "").trim();
  if (!t) return DEFAULT_AI_DISCLOSURE;
  if (/imagem gerada por intelig[eê]ncia artificial/i.test(t)) {
    return DEFAULT_AI_DISCLOSURE;
  }
  return t.startsWith("*") ? t : `*${t.replace(/^\*+/, "")}`;
}

function normalizeContactLine(contact: string): string {
  let t = contact.trim();
  t = t.replace(/^(➡️\s*)+/u, "").trim();
  return ensureArrowCta(t);
}

function normalizeHashtagsBlock(hashtags: string): string {
  return hashtags.trim().replace(/\s+/g, " ");
}

function appendCustomAt(
  parts: string[],
  anchor: CaptionFieldAnchor,
  customFields: CaptionCustomField[]
) {
  for (const field of customFields) {
    if (field.after === anchor && field.text.trim()) {
      parts.push(field.text.trim());
    }
  }
}

/** Remove blocos de rodapé que a IA possa ter repetido — mantém só o gancho principal. */
function extractHookBody(raw: string, footer: CaptionFooter): string {
  const customTexts = normalizeCaptionCustomFields(footer.customFields).map((f) => f.text);
  const footerNeedles = [
    footer.address,
    footer.contact,
    footer.hashtags,
    footer.extra,
    ...customTexts,
  ]
    .filter(Boolean)
    .map((s) => s!.trim().toLowerCase());

  const lines = raw.split(/\n+/);
  const kept: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^Refer[eê]ncia\s*:/i.test(t)) continue;
    if (/^\*?\s*Imagem gerada por intelig[eê]ncia artificial/i.test(t)) continue;
    if (/^➡️|^→/.test(t)) continue;
    if (/^(?:#\S+\s*)+$/.test(t)) continue;
    if (/^#/.test(t) && t.includes("#")) continue;
    const lower = t.toLowerCase();
    if (footerNeedles.some((needle) => needle.length > 8 && lower.includes(needle.slice(0, 24)))) {
      continue;
    }
    if (customTexts.some((ct) => ct.trim() === t)) continue;
    kept.push(t);
  }

  return kept.join("\n\n").trim();
}

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu;

function applyEmojiPolicy(text: string, policy: CaptionGenerationParams["emojiPolicy"]): string {
  if (policy === "free" || policy === "moderate") return text;
  if (policy === "none") return text.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
  // minimal: keep at most 1 emoji
  let count = 0;
  return text.replace(EMOJI_RE, (m) => {
    count += 1;
    return count <= 1 ? m : "";
  }).replace(/\s{2,}/g, " ").trim();
}

function limitHookSentences(text: string, maxSentences: number): string {
  if (maxSentences < 1 || !text) return text;
  const parts = text.split(/(?<=[.!?…])\s+/);
  if (parts.length <= maxSentences) return text;
  return parts.slice(0, maxSentences).join(" ").trim();
}

function trimHookToMaxChars(hook: string, maxHookChars: number): string {
  if (hook.length <= maxHookChars) return hook;
  const cut = hook.slice(0, maxHookChars);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxHookChars * 0.6) return `${cut.slice(0, lastSpace).trim()}…`;
  return `${cut.trim()}…`;
}

function enforceHookParams(hook: string, params: CaptionGenerationParams): string {
  let out = hook;
  out = applyEmojiPolicy(out, params.emojiPolicy);
  out = limitHookSentences(out, params.maxHookSentences);
  out = trimHookToMaxChars(out, params.maxHookChars);
  return out;
}

/** Remove cercas markdown/aspas que modelos costumam devolver no refine. */
export function sanitizeRefinedCaptionOutput(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:\w+)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }
  if (text.startsWith('"""') && text.endsWith('"""') && text.length > 6) {
    text = text.slice(3, -3).trim();
  }
  if (text.startsWith('"') && text.endsWith('"') && text.length > 2 && !text.includes("\n")) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

/** Texto principal da legenda (sem rodapé fixo nem campos extras). */
export function extractMainCaptionText(
  fullCaption: string,
  footer: CaptionFooter
): string {
  return extractHookBody(fullCaption, footer);
}

function trimInstagramHardMax(full: string): string {
  if (full.length <= INSTAGRAM_CAPTION_HARD_MAX) return full;
  return `${full.slice(0, INSTAGRAM_CAPTION_HARD_MAX - 1).trim()}…`;
}

/** Monta a legenda no layout fixo + campos extras do Gem. */
export function finalizeCaption(
  caption: string,
  options: {
    matchedCatalogId: string | null;
    matchedLabel?: string | null;
    footer: CaptionFooter;
    captionParams?: Partial<CaptionGenerationParams> | null;
  }
): string {
  const params = normalizeCaptionGenerationParams(options.captionParams);
  let hook = enforceHookParams(extractHookBody(caption, options.footer), params);
  const customFields = normalizeCaptionCustomFields(options.footer.customFields);
  const parts: string[] = [];

  if (hook) parts.push(hook);

  const hasReference =
    params.includeReferenceWhenMatched &&
    Boolean(options.matchedCatalogId && options.matchedLabel?.trim());
  if (hasReference) {
    parts.push(`Referência: ${options.matchedLabel!.trim()}`);
  }  appendCustomAt(parts, "after_reference", customFields);

  parts.push(normalizeDisclosure(options.footer.extra ?? ""));
  appendCustomAt(parts, "after_disclosure", customFields);

  if (options.footer.address?.trim()) {
    parts.push(options.footer.address.trim());
  }
  appendCustomAt(parts, "after_address", customFields);

  if (options.footer.contact?.trim()) {
    parts.push(normalizeContactLine(options.footer.contact));
  }
  appendCustomAt(parts, "after_contact", customFields);

  appendCustomAt(parts, "before_hashtags", customFields);

  if (options.footer.hashtags?.trim()) {
    parts.push(normalizeHashtagsBlock(options.footer.hashtags));
  }

  return trimInstagramHardMax(parts.filter(Boolean).join("\n\n"));
}
/** @deprecated Use finalizeCaption */
export function applyCaptionReferenceRule(
  caption: string,
  matchedCatalogId: string | null,
  matchedLabel?: string | null,
  footer?: CaptionFooter
): string {
  return finalizeCaption(caption, {
    matchedCatalogId,
    matchedLabel,
    footer: footer ?? {
      structure: "",
      address: "",
      contact: "",
      hashtags: "",
      extra: "",
      customFields: [],
    },
  });
}
