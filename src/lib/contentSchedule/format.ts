import type { ContentScheduleItem, ContentScheduleItemStatus } from "../../types";
import { CONTENT_SCHEDULE_STATUS_LABELS } from "./formatLabels";

export { CONTENT_SCHEDULE_STATUS_LABELS };

export function formatScheduleItemHeader(item: ContentScheduleItem): string {
  const kind = item.section === "posts" ? "POST" : "STORY";
  const datePart = item.scheduledDate ? ` | ${item.scheduledDate}` : "";
  const status = CONTENT_SCHEDULE_STATUS_LABELS[item.status];
  return `${kind} ${item.order} (${item.postType})${datePart} | ${status}`;
}

export function formatScheduleItemCopy(item: ContentScheduleItem): string {
  const lines: string[] = [];
  lines.push(formatScheduleItemHeader(item));
  lines.push("");
  lines.push(`Headline: ${item.headline}`);
  lines.push(`Frase de Apoio: ${item.subtitle}`);
  lines.push(`CTA: ${item.cta}`);
  if (item.storyExtras?.pollOptions) {
    lines.push(`Enquete: (${item.storyExtras.pollOptions[0]} / ${item.storyExtras.pollOptions[1]})`);
  }
  if (item.storyExtras?.onScreenText) {
    lines.push(`Texto na tela: ${item.storyExtras.onScreenText}`);
  }
  lines.push("");
  if (item.section === "stories") {
    lines.push("Texto de apoio:");
  } else {
    lines.push("Legenda:");
  }
  lines.push(item.legenda);
  if (item.section === "posts" && item.hashtags.trim()) {
    lines.push("");
    lines.push("Hashtags:");
    lines.push(item.hashtags.trim());
  }
  if (item.imagePrompt?.trim()) {
    lines.push("");
    lines.push("Prompt de imagem:");
    lines.push(item.imagePrompt.trim());
  }
  return lines.join("\n");
}

export function formatFullSchedule(
  items: ContentScheduleItem[],
  options?: { periodLabel?: string; brandName?: string }
): string {
  const posts = items.filter((i) => i.section === "posts").sort((a, b) => a.order - b.order);
  const stories = items.filter((i) => i.section === "stories").sort((a, b) => a.order - b.order);

  const title = options?.periodLabel
    ? `Cronograma de Conteúdo ${options.periodLabel}`
    : "Cronograma de Conteúdo";
  const context = options?.brandName
    ? `${options.brandName} | Posts de Arte + Stories`
    : "Posts de Arte + Stories";

  const header = `${title}\n${context}\n${"=".repeat(48)}\n`;
  const sections = [
    { title: "SEÇÃO 1: POSTS DE ARTE", items: posts },
    { title: "SEÇÃO 2: STORIES", items: stories },
  ];
  const body = sections
    .filter((s) => s.items.length > 0)
    .map((s) => {
      const blocks = s.items.map((item) => formatScheduleItemCopy(item)).join("\n\n---\n\n");
      return `${s.title} (${s.items.length})\n\n${blocks}`;
    })
    .join(`\n\n${"=".repeat(48)}\n\n`);
  return header + body;
}

export function buildCaptionFromScheduleItem(item: ContentScheduleItem): string {
  const parts = [item.legenda.trim()];
  if (item.section === "posts" && item.hashtags.trim()) parts.push(item.hashtags.trim());
  return parts.filter(Boolean).join("\n\n");
}

export { createScheduleItemId } from "./normalize";
