import type { ContentScheduleItem } from "../../types";

const GENERIC_PHRASES = [
  /solu[cç][aã]o completa/i,
  /inove seu neg[oó]cio/i,
  /transforme seu neg[oó]cio/i,
  /qualidade e excel[eê]ncia/i,
  /o melhor para voc[eê]/i,
  /conte conosco/i,
  /sua empresa merece/i,
  /n[aã]o perca tempo/i,
  /venha conhecer/i,
  /clique no link/i,
];

const GENERIC_CTA_PATTERNS = [
  /^saiba mais\.?$/i,
  /^clique aqui\.?$/i,
  /^confira\.?$/i,
  /^acesse o link\.?$/i,
  /^entre em contato\.?$/i,
];

export type CopyQualityIssue =
  | "generic_headline"
  | "weak_subtitle"
  | "generic_cta"
  | "duplicate_cta"
  | "story_has_hashtags"
  | "story_legenda_too_long"
  | "missing_image_prompt";

export type CopyQualityHint = {
  issue: CopyQualityIssue;
  label: string;
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const ISSUE_LABELS: Record<CopyQualityIssue, string> = {
  generic_headline: "Headline genérica",
  weak_subtitle: "Frase de apoio curta",
  generic_cta: "CTA genérica",
  duplicate_cta: "CTA repetitiva",
  story_has_hashtags: "Story com hashtags",
  story_legenda_too_long: "Texto de apoio longo demais",
  missing_image_prompt: "Sem prompt de imagem",
};

export function assessScheduleItemQuality(
  item: Pick<
    ContentScheduleItem,
    "section" | "headline" | "subtitle" | "cta" | "legenda" | "hashtags" | "imagePrompt"
  >,
  options?: { ctaCounts?: Map<string, number> }
): CopyQualityIssue[] {
  const issues: CopyQualityIssue[] = [];
  const headline = item.headline?.trim() ?? "";
  const subtitle = item.subtitle?.trim() ?? "";
  const cta = item.cta?.trim() ?? "";
  const legenda = item.legenda?.trim() ?? "";
  const hashtags = item.hashtags?.trim() ?? "";

  if (!headline || GENERIC_PHRASES.some((re) => re.test(headline))) {
    issues.push("generic_headline");
  }
  if (wordCount(subtitle) < 8) {
    issues.push("weak_subtitle");
  }
  if (!cta || GENERIC_CTA_PATTERNS.some((re) => re.test(cta))) {
    issues.push("generic_cta");
  }

  const normalizedCta = cta.toLowerCase().replace(/\s+/g, " ");
  if (options?.ctaCounts && normalizedCta) {
    const count = options.ctaCounts.get(normalizedCta) ?? 0;
    if (count > 1) issues.push("duplicate_cta");
  }

  if (item.section === "stories") {
    if (hashtags) issues.push("story_has_hashtags");
    if (wordCount(legenda) > 45) issues.push("story_legenda_too_long");
  }

  if (!item.imagePrompt?.trim()) {
    issues.push("missing_image_prompt");
  }

  return issues;
}

export function getScheduleItemQualityHints(item: ContentScheduleItem): CopyQualityHint[] {
  return assessScheduleItemQuality(item).map((issue) => ({
    issue,
    label: ISSUE_LABELS[issue],
  }));
}

export const COPY_QUALITY_RETRY_INSTRUCTION = `REGENERE com copy mais forte e específica:
- Headline: dor ou benefício concreto (produto, cenário ou resultado real da marca).
- Frase de apoio: 10-18 palavras, explicativa, sem repetir a headline.
- CTA: variada (pergunta, convite, comentário, diagnóstico) — evite "saiba mais" e "clique aqui".
- Siga ESTRITAMENTE o briefing do cliente; não invente temas fora do briefing.
- Inclua imagePrompt detalhado para o designer.`;

export function assessScheduleItemsQuality(items: ContentScheduleItem[]): CopyQualityIssue[] {
  const ctaCounts = new Map<string, number>();
  for (const item of items) {
    const key = item.cta.trim().toLowerCase().replace(/\s+/g, " ");
    if (!key) continue;
    ctaCounts.set(key, (ctaCounts.get(key) ?? 0) + 1);
  }

  const allIssues = new Set<CopyQualityIssue>();
  for (const item of items) {
    for (const issue of assessScheduleItemQuality(item, { ctaCounts })) {
      allIssues.add(issue);
    }
  }
  return [...allIssues];
}
