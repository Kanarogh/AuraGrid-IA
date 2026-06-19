import type { PlannedPost, RepeatingText } from "../types";
import { extractMainCaptionText } from "./captionFormat";

const PT_STOPWORDS = new Set([
  "para",
  "com",
  "que",
  "uma",
  "uns",
  "umas",
  "seu",
  "sua",
  "seus",
  "suas",
  "este",
  "esta",
  "esse",
  "essa",
  "isso",
  "aqui",
  "mais",
  "muito",
  "todo",
  "toda",
  "todos",
  "todas",
  "como",
  "sobre",
  "entre",
  "pelo",
  "pela",
  "pelos",
  "pelas",
  "onde",
  "quando",
  "porque",
  "por",
  "dos",
  "das",
  "nos",
  "nas",
  "aos",
  "às",
]);

/** Ganchos já gerados no roteiro — enviados à IA para evitar legendas repetidas. */
export function collectRecentCaptionHooks(
  posts: PlannedPost[],
  excludePostId: string,
  footer: RepeatingText,
  max = 15
): string[] {
  const hooks: string[] = [];
  const sorted = [...posts].sort(
    (a, b) => a.dayNumber - b.dayNumber || a.id.localeCompare(b.id)
  );

  for (const post of sorted) {
    if (post.id === excludePostId || !post.caption?.trim()) continue;
    const hook = extractMainCaptionText(post.caption, footer).trim();
    if (!hook) continue;
    if (hooks.some((h) => h.toLowerCase() === hook.toLowerCase())) continue;
    hooks.push(hook);
  }

  return hooks.slice(-max);
}

/** Extrai gancho completo, abridor (6–8 palavras) e palavras-chave para anti-repetição. */
export function extractCaptionAntiRepeatSignals(hook: string): string[] {
  const trimmed = hook.trim();
  if (!trimmed) return [];

  const words = trimmed.split(/\s+/).filter(Boolean);
  const signals: string[] = [trimmed];

  if (words.length >= 4) {
    const openerWords = words.slice(0, Math.min(8, words.length));
    const opener = openerWords.join(" ");
    if (
      opener.length >= 12 &&
      opener.toLowerCase() !== trimmed.toLowerCase()
    ) {
      signals.push(opener);
    }
  }

  const keywords = words
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
    .filter((w) => w.length > 4 && !PT_STOPWORDS.has(w));

  const seen = new Set(signals.map((s) => s.toLowerCase()));
  for (const kw of keywords) {
    if (seen.has(kw)) continue;
    seen.add(kw);
    signals.push(kw);
    if (signals.length >= 4) break;
  }

  return signals;
}

/** Mescla ganchos do roteiro + lote em curso (deduplicado, com abridores). */
export function mergeRecentCaptionSignals(
  posts: PlannedPost[],
  batchHooks: string[],
  excludePostId: string,
  footer: RepeatingText,
  max = 15
): string[] {
  const fromPosts = collectRecentCaptionHooks(posts, excludePostId, footer, max);
  const merged: string[] = [];
  const seen = new Set<string>();

  const addSignals = (raw: string) => {
    for (const signal of extractCaptionAntiRepeatSignals(raw)) {
      const key = signal.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(signal);
    }
  };

  for (const hook of batchHooks) addSignals(hook);
  for (const hook of fromPosts) addSignals(hook);

  return merged.slice(-max);
}
