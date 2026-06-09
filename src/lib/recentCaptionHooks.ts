import type { PlannedPost, RepeatingText } from "../types";
import { extractMainCaptionText } from "./captionFormat";

/** Ganchos já gerados no roteiro — enviados à IA para evitar legendas repetidas. */
export function collectRecentCaptionHooks(
  posts: PlannedPost[],
  excludePostId: string,
  footer: RepeatingText,
  max = 8
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
