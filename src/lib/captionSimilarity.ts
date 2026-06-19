/** Similaridade simples entre ganchos (overlap de tokens normalizados, 0–1). */

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
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
  threshold = 0.55
): boolean {
  const hook = candidate.trim();
  if (!hook) return false;

  return existing.some((entry) => {
    const other = entry.trim();
    if (!other) return false;
    if (other.toLowerCase() === hook.toLowerCase()) return true;
    return captionHookSimilarity(hook, other) >= threshold;
  });
}
