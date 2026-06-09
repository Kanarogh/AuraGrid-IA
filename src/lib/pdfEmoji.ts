/** Detecta emojis (inclui ZWJ sequences e variation selectors) */
export const EMOJI_REGEX =
  /(?:\p{Extended_Pictographic}\p{Emoji_Modifier}?|\p{Regional_Indicator}{2})(?:\uFE0F|\uFE0E)?(?:\u200D(?:\p{Extended_Pictographic}\p{Emoji_Modifier}?)(?:\uFE0F|\uFE0E)?)*/gu;

export function extractUniqueEmojis(texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(EMOJI_REGEX)) {
      found.add(match[0]);
    }
  }
  return [...found];
}

/** Renderiza emoji como PNG via fonte do sistema (compatível com jsPDF addImage) */
export function renderEmojiToDataUrl(emoji: string, px = 72): string {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.clearRect(0, 0, px, px);
  ctx.font = `${Math.round(px * 0.72)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, px / 2, px / 2 + px * 0.03);
  return canvas.toDataURL("image/png");
}

export async function buildEmojiCache(texts: string[]): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  for (const emoji of extractUniqueEmojis(texts)) {
    cache.set(emoji, renderEmojiToDataUrl(emoji));
  }
  return cache;
}
