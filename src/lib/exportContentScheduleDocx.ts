import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import type { ContentScheduleItem } from "../types";
import { CONTENT_SCHEDULE_STATUS_LABELS, formatScheduleItemHeader } from "./contentSchedule/format";

function itemFields(item: ContentScheduleItem): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [
    { label: "Headline", value: item.headline },
    { label: "Frase de Apoio", value: item.subtitle },
    { label: "CTA", value: item.cta },
  ];
  if (item.storyExtras?.pollOptions) {
    fields.push({
      label: "Enquete",
      value: `${item.storyExtras.pollOptions[0]} / ${item.storyExtras.pollOptions[1]}`,
    });
  }
  if (item.storyExtras?.onScreenText) {
    fields.push({ label: "Texto na tela", value: item.storyExtras.onScreenText });
  }
  fields.push({
    label: item.section === "stories" ? "Texto de apoio" : "Legenda",
    value: item.legenda,
  });
  if (item.section === "posts" && item.hashtags.trim()) {
    fields.push({ label: "Hashtags", value: item.hashtags.trim() });
  }
  if (item.imagePrompt?.trim()) {
    fields.push({ label: "Prompt de imagem", value: item.imagePrompt.trim() });
  }
  return fields.filter((f) => f.value.trim());
}

function buildItemParagraphs(item: ContentScheduleItem): Paragraph[] {
  const status = CONTENT_SCHEDULE_STATUS_LABELS[item.status];
  const header = formatScheduleItemHeader(item);
  const out: Paragraph[] = [
    new Paragraph({
      text: header,
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 240, after: 120 },
    }),
  ];
  for (const field of itemFields(item)) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${field.label}: `, bold: true }),
          new TextRun({ text: field.value }),
        ],
        spacing: { after: 80 },
      })
    );
  }
  out.push(
    new Paragraph({
      text: `Status: ${status}`,
      spacing: { after: 160 },
    })
  );
  return out;
}

function buildSection(title: string, items: ContentScheduleItem[]): Paragraph[] {
  if (items.length === 0) return [];
  return [
    new Paragraph({
      text: `${title} (${items.length})`,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 200 },
    }),
    ...items.flatMap((item) => buildItemParagraphs(item)),
  ];
}

export async function exportContentScheduleDocx(options: {
  items: ContentScheduleItem[];
  brandName: string;
  periodLabel: string;
  clientSlug?: string;
}): Promise<void> {
  const { items, brandName, periodLabel, clientSlug } = options;
  if (items.length === 0) {
    throw new Error("Nenhum item no cronograma para exportar.");
  }

  const posts = items.filter((i) => i.section === "posts").sort((a, b) => a.order - b.order);
  const stories = items.filter((i) => i.section === "stories").sort((a, b) => a.order - b.order);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: `Cronograma de Conteúdo ${periodLabel}`,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            text: `${brandName} | Posts de Arte + Stories`,
            spacing: { after: 300 },
          }),
          ...buildSection("SEÇÃO 1: POSTS DE ARTE", posts),
          ...buildSection("SEÇÃO 2: STORIES", stories),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const slug = (clientSlug || brandName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const safePeriod = periodLabel.replace(/\s+/g, "-").toLowerCase();
  const filename = `cronograma-${slug || "marca"}-${safePeriod || "conteudo"}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
