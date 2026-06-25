import type { ContentScheduleItem, ContentScheduleItemStatus } from "../../types";

export const CONTENT_SCHEDULE_STATUS_LABELS: Record<ContentScheduleItemStatus, string> = {
  draft: "Rascunho",
  approved: "Aprovado",
  handed_off: "Entregue",
  done: "Feito",
};

export function formatScheduleItemCopy(item: ContentScheduleItem): string {
  const lines: string[] = [];
  const datePart = item.scheduledDate ? ` | ${item.scheduledDate}` : "";
  lines.push(`${item.name} (${item.postType})${datePart}`);
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
  lines.push("Legenda:");
  lines.push(item.legenda);
  if (item.hashtags.trim()) {
    lines.push("");
    lines.push(item.hashtags.trim());
  }
  return lines.join("\n");
}

export function formatFullSchedule(
  items: ContentScheduleItem[],
  periodLabel?: string
): string {
  const posts = items.filter((i) => i.section === "posts").sort((a, b) => a.order - b.order);
  const stories = items.filter((i) => i.section === "stories").sort((a, b) => a.order - b.order);
  const header = periodLabel
    ? `Cronograma de Conteúdo — ${periodLabel}\n${"=".repeat(40)}\n`
    : "";
  const sections = [
    { title: "POSTS DE ARTE", items: posts },
    { title: "STORIES", items: stories },
  ];
  const body = sections
    .filter((s) => s.items.length > 0)
    .map((s) => {
      const blocks = s.items.map((item) => formatScheduleItemCopy(item)).join("\n\n---\n\n");
      return `${s.title}\n\n${blocks}`;
    })
    .join(`\n\n${"=".repeat(40)}\n\n`);
  return header + body;
}

export function buildCaptionFromScheduleItem(item: ContentScheduleItem): string {
  const parts = [item.legenda.trim()];
  if (item.hashtags.trim()) parts.push(item.hashtags.trim());
  return parts.filter(Boolean).join("\n\n");
}

export function createScheduleItemId(section: ContentScheduleItem["section"], order: number): string {
  return `schedule_${section}_${order}_${Date.now()}`;
}
