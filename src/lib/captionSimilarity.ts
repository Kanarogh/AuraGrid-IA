/** Similaridade entre ganchos — overlap de tokens, abridores e frases repetidas. */

export function normalizeCaptionCompare(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeCaptionCompare(text)
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function extractOpenerWords(hook: string, wordCount = 5): string[] {
  return hook
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, wordCount)
    .map((w) =>
      w
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}]/gu, "")
    )
    .filter(Boolean);
}

export function extractOpeningTemplate(hook: string, wordCount = 3): string {
  return extractOpenerWords(hook, wordCount).join(" ");
}

export function openerTemplateMatches(a: string, b: string, wordCount = 3): boolean {
  const ta = extractOpeningTemplate(a, wordCount);
  const tb = extractOpeningTemplate(b, wordCount);
  if (!ta || !tb) return false;
  return ta === tb;
}

/** Quantas das primeiras N palavras coincidem (mesma posição). */
export function openerPrefixOverlap(a: string, b: string, wordCount = 4): number {
  const wa = extractOpenerWords(a, wordCount);
  const wb = extractOpenerWords(b, wordCount);
  let match = 0;
  for (let i = 0; i < Math.min(wa.length, wb.length); i++) {
    if (wa[i] !== wb[i]) break;
    match++;
  }
  return match;
}

export function captionHookSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  let overlap = 0;
  for (const token of setA) {
    if (setB.has(token)) overlap++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? overlap / union : 0;
}

export function isHookTooSimilar(
  candidate: string,
  existing: string[],
  threshold = 0.42
): boolean {
  const hook = candidate.trim();
  if (!hook) return false;

  return existing.some((entry) => {
    const other = entry.trim();
    if (!other) return false;
    if (other.toLowerCase() === hook.toLowerCase()) return true;

    // Mesmo padrão de abertura (ex.: "Sumérgete en la")
    if (openerTemplateMatches(hook, other, 3)) return true;
    if (openerPrefixOverlap(hook, other, 4) >= 3) return true;

    // Abridores curtos já listados como sinal anti-repetição
    const otherWords = other.split(/\s+/).filter(Boolean).length;
    if (otherWords <= 8 && openerPrefixOverlap(hook, other, 6) >= 4) {
      return true;
    }

    return captionHookSimilarity(hook, other) >= threshold;
  });
}
