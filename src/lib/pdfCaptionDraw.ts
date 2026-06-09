import type { jsPDF } from "jspdf";
import { EMOJI_REGEX } from "./pdfEmoji";

type Token = { type: "text"; value: string } | { type: "emoji"; value: string };
type LineItem = { type: "text"; value: string } | { type: "emoji"; value: string };

type LayoutRow = { kind: "text"; items: LineItem[] } | { kind: "gap" };

export type CaptionDrawOptions = {
  fontSize: number;
  lineHeightMm: number;
  paragraphGapMm: number;
  emojiSizeMm: number;
  maxLines: number;
};

function tokenizeLine(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  const re = new RegExp(EMOJI_REGEX.source, "gu");
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ type: "text", value: text.slice(last, match.index) });
    }
    tokens.push({ type: "emoji", value: match[0] });
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    tokens.push({ type: "text", value: text.slice(last) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value: text }];
}

function wrapLineItems(
  pdf: jsPDF,
  tokens: Token[],
  maxWidth: number,
  emojiSizeMm: number
): LineItem[][] {
  const lines: LineItem[][] = [[]];
  let lineWidth = 0;

  const startNewLine = () => {
    lines.push([]);
    lineWidth = 0;
  };

  for (const token of tokens) {
    if (token.type === "emoji") {
      const w = emojiSizeMm + 0.35;
      if (lineWidth + w > maxWidth && lineWidth > 0) startNewLine();
      lines[lines.length - 1].push({ type: "emoji", value: token.value });
      lineWidth += w;
      continue;
    }

    const parts = token.value.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      const partWidth = pdf.getTextWidth(part);
      if (lineWidth + partWidth > maxWidth && lineWidth > 0) startNewLine();
      lines[lines.length - 1].push({ type: "text", value: part });
      lineWidth += partWidth;
    }
  }

  return lines.filter((line) => line.length > 0);
}

function buildLayoutRows(pdf: jsPDF, caption: string, maxWidth: number, emojiSizeMm: number): LayoutRow[] {
  const rows: LayoutRow[] = [];
  const paragraphs = caption.split("\n\n");

  paragraphs.forEach((paragraph, pi) => {
    const physicalLines = paragraph.split("\n");
    physicalLines.forEach((rawLine) => {
      const wrapped = wrapLineItems(pdf, tokenizeLine(rawLine), maxWidth, emojiSizeMm);
      for (const items of wrapped) {
        rows.push({ kind: "text", items });
      }
    });

    if (pi < paragraphs.length - 1) {
      rows.push({ kind: "gap" });
    }
  });

  return rows;
}

function appendEllipsisToRow(row: LineItem[]) {
  if (!row.length) return;
  const tail = row[row.length - 1];
  if (tail.type !== "text") return;
  tail.value = tail.value.replace(/\s+$/, "");
  tail.value = tail.value.length > 3 ? `${tail.value.slice(0, -3)}…` : `${tail.value}…`;
}

function drawLine(
  pdf: jsPDF,
  items: LineItem[],
  x: number,
  y: number,
  emojiCache: Map<string, string>,
  opts: CaptionDrawOptions
) {
  let cx = x;

  for (const item of items) {
    if (item.type === "text") {
      pdf.text(item.value, cx, y);
      cx += pdf.getTextWidth(item.value);
      continue;
    }

    const dataUrl = emojiCache.get(item.value);
    if (dataUrl) {
      pdf.addImage(
        dataUrl,
        "PNG",
        cx,
        y - opts.emojiSizeMm * 0.82,
        opts.emojiSizeMm,
        opts.emojiSizeMm
      );
    }

    pdf.text(item.value, cx + opts.emojiSizeMm * 0.12, y, { renderingMode: "invisible" });
    cx += opts.emojiSizeMm + 0.35;
  }
}

/** Preserva blocos `\n\n` da legenda gerada; texto e emoji copiáveis */
export function drawCaptionWithEmojis(
  pdf: jsPDF,
  caption: string,
  box: { x: number; y: number; w: number; h: number },
  emojiCache: Map<string, string>,
  opts: CaptionDrawOptions
) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(opts.fontSize);
  pdf.setTextColor(51, 65, 85);

  const rows = buildLayoutRows(pdf, caption, box.w, opts.emojiSizeMm);
  const textRowCount = rows.filter((r) => r.kind === "text").length;

  let textLinesUsed = 0;
  let truncated = false;
  let cy = box.y + 2.2;

  for (const row of rows) {
    if (row.kind === "gap") {
      if (truncated) break;
      cy += opts.paragraphGapMm;
      continue;
    }

    if (textLinesUsed >= opts.maxLines) break;

    const isOverflow = textLinesUsed === opts.maxLines - 1 && textRowCount > opts.maxLines;
    if (isOverflow) {
      appendEllipsisToRow(row.items);
      truncated = true;
    }

    drawLine(pdf, row.items, box.x, cy, emojiCache, opts);
    cy += opts.lineHeightMm;
    textLinesUsed++;

    if (truncated) break;
  }
}
