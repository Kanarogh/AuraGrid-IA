import type { PlannedPost, RepeatingText } from "../types";
import { extractMainCaptionText } from "./captionFormat";
import { normalizeCaptionCompare } from "./captionSimilarity";

const STOPWORDS = new Set([
  // PT
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
  // ES
  "para",
  "con",
  "que",
  "una",
  "unos",
  "unas",
  "este",
  "esta",
  "ese",
  "esa",
  "esto",
  "aqui",
  "mas",
  "muy",
  "todo",
  "toda",
  "todos",
  "todas",
  "como",
  "sobre",
  "entre",
  "donde",
  "cuando",
  "porque",
  "por",
  "del",
  "los",
  "las",
  "sus",
  "sus",
  "nos",
  "sus",
  "con",
  "una",
  "uno",
  "los",
  "las",
  "del",
  "de",
  "la",
  "el",
  "en",
  "un",
  "y",
  "es",
  "su",
  "se",
  "al",
  "lo",
]);

export type AntiRepeatAnalysis = {
  full: string[];
  openers: string[];
  templates: string[];
  phrases: string[];
};

function wordsOf(hook: string): string[] {
  return hook.trim().split(/\s+/).filter(Boolean);
}

function extractOpeningTemplate(hook: string, count = 3): string {
  const words = wordsOf(hook).slice(0, count);
  if (words.length < 2) return "";
  return normalizeCaptionCompare(words.join(" "));
}

function ngrams(words: string[], size: number): string[] {
  if (words.length < size) return [];
  const grams: string[] = [];
  for (let i = 0; i <= words.length - size; i++) {
    const slice = words.slice(i, i + size);
    if (slice.some((w) => STOPWORDS.has(normalizeCaptionCompare(w)))) continue;
    const phrase = normalizeCaptionCompare(slice.join(" "));
    if (phrase.split(/\s+/).filter((w) => w.length > 2).length < size) continue;
    grams.push(phrase);
  }
  return grams;
}

/** Frases de 2–3 palavras que aparecem em mais de um gancho recente. */
export function extractRepeatedPhraseClusters(hooks: string[]): string[] {
  const counts = new Map<string, number>();

  for (const hook of hooks) {
    const normalized = normalizeCaptionCompare(hook);
    const words = normalized.split(/\s+/).filter((w) => w.length > 2);
    const local = new Set<string>();

    for (const size of [2, 3]) {
      for (const gram of ngrams(words, size)) {
        local.add(gram);
      }
    }

    for (const gram of local) {
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([phrase]) => phrase)
    .slice(0, 12);
}

export function analyzeRecentCaptionHooks(raw: string[]): AntiRepeatAnalysis {
  const full: string[] = [];
  const openers: string[] = [];
  const templates = new Set<string>();

  for (const hook of raw) {
    const trimmed = hook.trim();
    if (!trimmed) continue;

    const wordCount = wordsOf(trimmed).length;
    const template = extractOpeningTemplate(trimmed, 3);
    if (template) templates.add(template);

    if (wordCount >= 4 && wordCount <= 8 && trimmed.length < 90) {
      if (!openers.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
        openers.push(trimmed);
      }
      continue;
    }

    if (wordCount < 4 || trimmed.length < 12) continue;
    if (full.some((h) => h.toLowerCase() === trimmed.toLowerCase())) continue;
    full.push(trimmed);

    if (wordCount >= 4) {
      const opener = wordsOf(trimmed).slice(0, Math.min(8, wordCount)).join(" ");
      if (
        opener.length >= 12 &&
        opener.toLowerCase() !== trimmed.toLowerCase() &&
        !openers.some((o) => o.toLowerCase() === opener.toLowerCase())
      ) {
        openers.push(opener);
      }
    }
  }

  const fullHooks = full.slice(-8);
  const phrases = extractRepeatedPhraseClusters([
    ...fullHooks,
    ...openers.filter((o) => wordsOf(o).length > 8),
  ]);

  return {
    full: fullHooks,
    openers: openers.slice(-8),
    templates: [...templates].slice(-10),
    phrases,
  };
}

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

/** Extrai gancho completo, abridor, template e palavras-chave para anti-repetição. */
export function extractCaptionAntiRepeatSignals(hook: string): string[] {
  const trimmed = hook.trim();
  if (!trimmed) return [];

  const words = wordsOf(trimmed);
  const signals: string[] = [trimmed];

  const template = extractOpeningTemplate(trimmed, 3);
  if (template) signals.push(template);

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
    .filter((w) => w.length > 4 && !STOPWORDS.has(w));

  const seen = new Set(signals.map((s) => s.toLowerCase()));
  for (const kw of keywords) {
    if (seen.has(kw)) continue;
    seen.add(kw);
    signals.push(kw);
    if (signals.length >= 5) break;
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
