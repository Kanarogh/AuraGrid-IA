import { jsPDF } from "jspdf";
import type { ContentScheduleItem } from "../types";
import {
  CONTENT_SCHEDULE_STATUS_LABELS,
  formatScheduleItemCopy,
  formatScheduleItemHeader,
} from "./contentSchedule/format";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const LINE_H = 5.2;
const FOOTER_H = 10;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function splitLines(pdf: jsPDF, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text, maxWidth) as string[];
}

type PdfCursor = { y: number; page: number };

function ensureSpace(
  pdf: jsPDF,
  cursor: PdfCursor,
  needed: number,
  totalPagesRef: { value: number }
) {
  if (cursor.y + needed > PAGE_H - MARGIN - FOOTER_H) {
    pdf.addPage();
    cursor.page += 1;
    totalPagesRef.value += 1;
    cursor.y = MARGIN;
  }
}

function drawFooter(pdf: jsPDF, page: number, totalPages: number) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  const label = `-- ${page} of ${totalPages} --`;
  const w = pdf.getTextWidth(label);
  pdf.text(label, (PAGE_W - w) / 2, PAGE_H - 8);
}

function drawDocumentTitle(
  pdf: jsPDF,
  cursor: PdfCursor,
  opts: { title: string; context: string; accent: [number, number, number] },
  totalPagesRef: { value: number }
) {
  ensureSpace(pdf, cursor, 28, totalPagesRef);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(...opts.accent);
  pdf.text(opts.title, MARGIN, cursor.y);
  cursor.y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);
  pdf.text(opts.context, MARGIN, cursor.y);
  cursor.y += 6;

  pdf.setDrawColor(220, 220, 220);
  pdf.line(MARGIN, cursor.y, PAGE_W - MARGIN, cursor.y);
  cursor.y += 10;
}

function drawSectionTitle(
  pdf: jsPDF,
  cursor: PdfCursor,
  title: string,
  count: number,
  totalPagesRef: { value: number }
) {
  ensureSpace(pdf, cursor, 14, totalPagesRef);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(30, 30, 30);
  pdf.text(`${title} (${count})`, MARGIN, cursor.y);
  cursor.y += 8;
}

function drawItemBlock(
  pdf: jsPDF,
  cursor: PdfCursor,
  item: ContentScheduleItem,
  totalPagesRef: { value: number }
) {
  const maxW = PAGE_W - MARGIN * 2;
  const header = formatScheduleItemHeader(item);
  ensureSpace(pdf, cursor, 12, totalPagesRef);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(40, 40, 40);
  for (const line of splitLines(pdf, header, maxW)) {
    ensureSpace(pdf, cursor, LINE_H, totalPagesRef);
    pdf.text(line, MARGIN, cursor.y);
    cursor.y += LINE_H;
  }
  cursor.y += 2;

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

  for (const field of fields) {
    if (!field.value.trim()) continue;
    ensureSpace(pdf, cursor, LINE_H * 2, totalPagesRef);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`${field.label}:`, MARGIN, cursor.y);
    cursor.y += LINE_H;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(30, 30, 30);
    for (const line of splitLines(pdf, field.value, maxW)) {
      ensureSpace(pdf, cursor, LINE_H, totalPagesRef);
      pdf.text(line, MARGIN, cursor.y);
      cursor.y += LINE_H;
    }
    cursor.y += 2;
  }

  cursor.y += 4;
  pdf.setDrawColor(235, 235, 235);
  pdf.line(MARGIN, cursor.y, PAGE_W - MARGIN, cursor.y);
  cursor.y += 8;
}

export async function buildContentSchedulePdf(options: {
  items: ContentScheduleItem[];
  brandName: string;
  periodLabel: string;
  accentColor?: string;
}): Promise<jsPDF> {
  const { items, brandName, periodLabel, accentColor = "#7b5cff" } = options;
  const accent = hexToRgb(accentColor);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const totalPagesRef = { value: 1 };
  const cursor: PdfCursor = { y: MARGIN, page: 1 };

  const posts = items.filter((i) => i.section === "posts").sort((a, b) => a.order - b.order);
  const stories = items.filter((i) => i.section === "stories").sort((a, b) => a.order - b.order);

  drawDocumentTitle(pdf, cursor, {
    title: `Cronograma de Conteúdo ${periodLabel}`,
    context: `${brandName} | Posts de Arte + Stories`,
    accent,
  }, totalPagesRef);

  if (posts.length > 0) {
    drawSectionTitle(pdf, cursor, "SEÇÃO 1: POSTS DE ARTE", posts.length, totalPagesRef);
    for (const item of posts) {
      drawItemBlock(pdf, cursor, item, totalPagesRef);
    }
  }

  if (stories.length > 0) {
    drawSectionTitle(pdf, cursor, "SEÇÃO 2: STORIES", stories.length, totalPagesRef);
    for (const item of stories) {
      drawItemBlock(pdf, cursor, item, totalPagesRef);
    }
  }

  if (items.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("Nenhum item no cronograma.", MARGIN, cursor.y);
  }

  const total = totalPagesRef.value;
  for (let p = 1; p <= total; p += 1) {
    pdf.setPage(p);
    drawFooter(pdf, p, total);
  }

  return pdf;
}

/** Texto plano para debug / fallback */
export function buildContentSchedulePdfPreviewText(items: ContentScheduleItem[]): string {
  return items.map((item) => formatScheduleItemCopy(item)).join("\n\n---\n\n");
}

/** Status label export for PDF header consistency */
export function scheduleStatusLabel(status: ContentScheduleItem["status"]): string {
  return CONTENT_SCHEDULE_STATUS_LABELS[status];
}
