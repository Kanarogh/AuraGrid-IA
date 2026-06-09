import { jsPDF } from "jspdf";
import type { PlannedPost } from "../types";
import {
  formatRoteiroPeriod,
  getPostCalendarDay,
  getPostWeekdayShort,
} from "./roteiroPdfDates";
import { drawCaptionWithEmojis } from "./pdfCaptionDraw";
import { buildEmojiCache } from "./pdfEmoji";
import { normalizeCaptionForPdf, sanitizeBadgeMetaForPdf } from "./pdfTextSanitize";

const COLS_PER_PAGE = 6;
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 5;
const COL_GAP = 1.6;
const COL_W = (PAGE_W - MARGIN * 2 - COL_GAP * (COLS_PER_PAGE - 1)) / COLS_PER_PAGE;
const HEADER_H = 14;
const FOOTER_H = 6;
const GRID_TOP = MARGIN + HEADER_H + 1.5;
const GRID_H = PAGE_H - GRID_TOP - MARGIN - FOOTER_H - 1;
const BADGE_H = 7;
const CARD_PAD = 1.4;
const IMG_W = COL_W - CARD_PAD * 2;
const IMG_H = (IMG_W * 5) / 4;
const CAPTION_PAD = 1.2;
const CAPTION_INNER_W = IMG_W - CAPTION_PAD * 2;
const CAPTION_TOP_IN_CARD = BADGE_H + IMG_H + CARD_PAD * 2 + 0.8;
const CAPTION_H = GRID_H - CAPTION_TOP_IN_CARD - CARD_PAD;

const CROP_PX = 480;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function imageFormat(dataUrl: string): "JPEG" | "PNG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

/** Recorta imagem para 4:5 (cover) antes de embutir no PDF */
export async function cropImageForPdf(src: string): Promise<string | null> {
  if (!src) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const outW = CROP_PX;
      const outH = Math.round((outW * 5) / 4);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      const scale = Math.max(outW / img.width, outH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (outW - dw) / 2, (outH - dh) / 2, dw, dh);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawPageHeader(
  pdf: jsPDF,
  opts: {
    brandName: string;
    period: string;
    pageIndex: number;
    totalPages: number;
    totalPosts: number;
    accent: [number, number, number];
  }
) {
  const { brandName, period, pageIndex, totalPages, totalPosts, accent } = opts;
  const y = MARGIN + 4;

  pdf.setFillColor(...accent);
  pdf.rect(MARGIN, MARGIN + 1, 1.2, 10, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.setTextColor(...accent);
  pdf.text("ROTEIRO EDITORIAL", MARGIN + 3, y);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(15, 23, 42);
  const brandX = MARGIN + 3;
  const brandY = y + 5.5;
  pdf.text(brandName, brandX, brandY);
  const brandWidth = pdf.getTextWidth(brandName);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(period, brandX + brandWidth + 5, brandY);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  const postsLabel = `${totalPosts} posts`;
  const pageLabel = `${pageIndex + 1} / ${totalPages}`;
  pdf.text(pageLabel, PAGE_W - MARGIN, y + 1, { align: "right" });
  pdf.text(postsLabel, PAGE_W - MARGIN - pdf.getTextWidth(pageLabel) - 4, y + 1, {
    align: "right",
  });

  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, MARGIN + HEADER_H, PAGE_W - MARGIN, MARGIN + HEADER_H);
}

function drawPageFooter(pdf: jsPDF, exportedAt: string) {
  const y = PAGE_H - MARGIN - 1;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(MARGIN, y - 3, PAGE_W - MARGIN, y - 3);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6);
  pdf.setTextColor(148, 163, 184);
  pdf.text("AuraGrid · Planejamento visual", MARGIN, y);
  pdf.text(`4:5 · ${exportedAt}`, PAGE_W - MARGIN, y, { align: "right" });
}

function drawCard(
  pdf: jsPDF,
  opts: {
    x: number;
    post: PlannedPost;
    startDate: string;
    accent: [number, number, number];
    imageDataUrl: string | null;
    emojiCache: Map<string, string>;
  }
) {
  const { x, post, startDate, accent, imageDataUrl, emojiCache } = opts;
  const y = GRID_TOP;
  const dayNum = getPostCalendarDay(post, startDate);
  const weekdayShort = getPostWeekdayShort(post, startDate);
  const meta = sanitizeBadgeMetaForPdf(
    `${weekdayShort} · D${post.dayNumber}${post.isConfirmed ? " · OK" : ""}`
  );
  const caption = normalizeCaptionForPdf(post.caption?.trim() || "Legenda pendente.");

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(x, y, COL_W, GRID_H, 1.5, 1.5, "FD");

  pdf.setFillColor(...accent);
  pdf.rect(x, y, COL_W, BADGE_H, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  pdf.text(dayNum, x + 2, y + 5.2);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.5);
  pdf.text(meta, x + COL_W - 2, y + 5.2, { align: "right" });

  const imgX = x + CARD_PAD;
  const imgY = y + BADGE_H + CARD_PAD;

  if (imageDataUrl) {
    pdf.addImage(imageDataUrl, imageFormat(imageDataUrl), imgX, imgY, IMG_W, IMG_H);
  } else {
    pdf.setFillColor(241, 245, 249);
    pdf.rect(imgX, imgY, IMG_W, IMG_H, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6);
    pdf.setTextColor(148, 163, 184);
    pdf.text("Sem foto", imgX + IMG_W / 2, imgY + IMG_H / 2, { align: "center" });
  }

  const capBoxY = y + CAPTION_TOP_IN_CARD;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(241, 245, 249);
  pdf.roundedRect(x + CARD_PAD, capBoxY, IMG_W, CAPTION_H, 1, 1, "FD");

  const lineHeight = 2.55;
  const maxLines = Math.max(1, Math.floor((CAPTION_H - CAPTION_PAD * 2) / lineHeight));

  drawCaptionWithEmojis(
    pdf,
    caption,
    {
      x: x + CARD_PAD + CAPTION_PAD,
      y: capBoxY + CAPTION_PAD,
      w: CAPTION_INNER_W,
      h: CAPTION_H - CAPTION_PAD * 2,
    },
    emojiCache,
    {
      fontSize: 5.4,
      lineHeightMm: lineHeight,
      paragraphGapMm: 1.1,
      emojiSizeMm: 2.35,
      maxLines,
    }
  );
}

export async function buildRoteiroPdf(options: {
  posts: PlannedPost[];
  brandName: string;
  startDate: string;
  accentColor: string;
}): Promise<jsPDF> {
  const { posts, brandName, startDate, accentColor } = options;
  const accent = hexToRgb(accentColor);

  const sorted = [...posts]
    .filter((p) => p.image || p.caption?.trim())
    .sort((a, b) => a.dayNumber - b.dayNumber || a.id.localeCompare(b.id));

  const pages = chunk(sorted, COLS_PER_PAGE);
  const period = formatRoteiroPeriod(startDate, sorted.length);
  const exportedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const croppedImages = await Promise.all(
    sorted.map((post) => cropImageForPdf(post.image ?? ""))
  );
  const imageByPostId = new Map(sorted.map((post, i) => [post.id, croppedImages[i]]));

  const emojiCache = await buildEmojiCache(
    sorted.map((post) => post.caption?.trim() || "")
  );

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  pdf.setProperties({
    title: `Roteiro — ${brandName}`,
    subject: "Planejamento editorial AuraGrid",
  });

  pages.forEach((pagePosts, pageIndex) => {
    if (pageIndex > 0) pdf.addPage();

    pdf.setFillColor(241, 245, 249);
    pdf.rect(0, 0, PAGE_W, PAGE_H, "F");

    drawPageHeader(pdf, {
      brandName,
      period,
      pageIndex,
      totalPages: pages.length,
      totalPosts: sorted.length,
      accent,
    });

    pagePosts.forEach((post, colIndex) => {
      const cardX = MARGIN + colIndex * (COL_W + COL_GAP);
      drawCard(pdf, {
        x: cardX,
        post,
        startDate,
        accent,
        imageDataUrl: imageByPostId.get(post.id) ?? null,
        emojiCache,
      });
    });

    drawPageFooter(pdf, exportedAt);
  });

  return pdf;
}
