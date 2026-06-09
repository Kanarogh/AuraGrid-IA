import { jsPDF } from "jspdf";
import type { CanvaGridPage } from "../types";
import type { CanvaGridFormat } from "./canvaGridFormats";

const COLS = 3;
const ROWS = 4;
const SLOTS_PER_PAGE = COLS * ROWS;
const GAP_MM = 2;
const MARGIN = 8;
const HEADER_H = 14;
const FOOTER_H = 7;
const CROP_PX = 720;

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

/** Recorta imagem para a proporção do grid (cover). */
export async function cropImageToAspectRatio(
  src: string,
  aspectRatio: number
): Promise<string | null> {
  if (!src) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const outW = CROP_PX;
      const outH = Math.round(outW / aspectRatio);
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
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function pageDimensions(formatId: CanvaGridFormat["id"]): {
  width: number;
  height: number;
  orientation: "landscape" | "portrait";
} {
  if (formatId === "stories") {
    return { width: 210, height: 297, orientation: "portrait" };
  }
  return { width: 297, height: 210, orientation: "landscape" };
}

function computeCellLayout(
  pageW: number,
  pageH: number,
  aspectRatio: number
): { cellW: number; cellH: number; gridW: number; gridH: number; gridX: number; gridY: number } {
  const gridAreaW = pageW - MARGIN * 2;
  const gridAreaH = pageH - MARGIN - HEADER_H - FOOTER_H - MARGIN - 2;

  let cellW = (gridAreaW - (COLS - 1) * GAP_MM) / COLS;
  let cellH = cellW / aspectRatio;
  let totalH = cellH * ROWS + (ROWS - 1) * GAP_MM;

  if (totalH > gridAreaH) {
    cellH = (gridAreaH - (ROWS - 1) * GAP_MM) / ROWS;
    cellW = cellH * aspectRatio;
  }

  const gridW = cellW * COLS + (COLS - 1) * GAP_MM;
  const gridH = cellH * ROWS + (ROWS - 1) * GAP_MM;

  return {
    cellW,
    cellH,
    gridW,
    gridH,
    gridX: MARGIN + (gridAreaW - gridW) / 2,
    gridY: MARGIN + HEADER_H + 2,
  };
}

function drawHeader(
  pdf: jsPDF,
  opts: {
    brandName: string;
    pageName: string;
    formatMeta: CanvaGridFormat;
    pageIndex: number;
    totalPages: number;
    accent: [number, number, number];
    pageW: number;
  }
) {
  const { brandName, pageName, formatMeta, pageIndex, totalPages, accent, pageW } = opts;
  const y = MARGIN + 4;

  pdf.setFillColor(...accent);
  pdf.rect(MARGIN, MARGIN + 1, 1.2, 10, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.setTextColor(...accent);
  pdf.text("GRID CANVA", MARGIN + 3, y);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text(brandName, MARGIN + 3, y + 5.5);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `${pageName} · ${formatMeta.ratioLabel} (${formatMeta.dimensions}px)`,
    MARGIN + 3,
    y + 10
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text(`${pageIndex + 1} / ${totalPages}`, pageW - MARGIN, y + 2, { align: "right" });

  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, MARGIN + HEADER_H, pageW - MARGIN, MARGIN + HEADER_H);
}

function drawFooter(pdf: jsPDF, formatMeta: CanvaGridFormat, exportedAt: string, pageW: number, pageH: number) {
  const y = pageH - MARGIN - 1;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(MARGIN, y - 3, pageW - MARGIN, y - 3);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6);
  pdf.setTextColor(148, 163, 184);
  pdf.text("AuraGrid · Grid Canva", MARGIN, y);
  pdf.text(`${formatMeta.ratioLabel} · ${exportedAt}`, pageW - MARGIN, y, { align: "right" });
}

function drawSlot(
  pdf: jsPDF,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    imageDataUrl: string | null;
  }
) {
  const { x, y, w, h, imageDataUrl } = opts;
  if (!imageDataUrl) return;

  pdf.addImage(imageDataUrl, imageFormat(imageDataUrl), x, y, w, h);
}

export async function buildCanvaGridPdf(options: {
  pages: CanvaGridPage[];
  brandName: string;
  accentColor: string;
  formatMeta: CanvaGridFormat;
  /** Map slot.id → cropped image data URL */
  imagesBySlotId: Map<string, string | null>;
}): Promise<jsPDF> {
  const { pages, brandName, accentColor, formatMeta, imagesBySlotId } = options;
  const accent = hexToRgb(accentColor);
  const { width: PAGE_W, height: PAGE_H, orientation } = pageDimensions(formatMeta.id);
  const layout = computeCellLayout(PAGE_W, PAGE_H, formatMeta.aspectRatio);

  const exportedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });

  pdf.setProperties({
    title: `Grid Canva — ${brandName}`,
    subject: "Grid visual AuraGrid",
  });

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) pdf.addPage();

    pdf.setFillColor(241, 245, 249);
    pdf.rect(0, 0, PAGE_W, PAGE_H, "F");

    drawHeader(pdf, {
      brandName,
      pageName: page.name,
      formatMeta,
      pageIndex,
      totalPages: pages.length,
      accent,
      pageW: PAGE_W,
    });

    page.slots.slice(0, SLOTS_PER_PAGE).forEach((slot, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const x = layout.gridX + col * (layout.cellW + GAP_MM);
      const y = layout.gridY + row * (layout.cellH + GAP_MM);

      drawSlot(pdf, {
        x,
        y,
        w: layout.cellW,
        h: layout.cellH,
        imageDataUrl: imagesBySlotId.get(slot.id) ?? null,
      });
    });

    drawFooter(pdf, formatMeta, exportedAt, PAGE_W, PAGE_H);
  });

  return pdf;
}

export function countCanvaGridImages(pages: CanvaGridPage[]): number {
  return pages.reduce(
    (sum, page) => sum + page.slots.filter((s) => s.image).length,
    0
  );
}

export async function prepareCanvaGridImagesForPdf(
  pages: CanvaGridPage[],
  aspectRatio: number,
  resolveImage: (src: string) => Promise<string | null>
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();

  await Promise.all(
    pages.flatMap((page) =>
      page.slots.map(async (slot) => {
        if (!slot.image) {
          map.set(slot.id, null);
          return;
        }
        const resolved = await resolveImage(slot.image);
        const cropped = resolved ? await cropImageToAspectRatio(resolved, aspectRatio) : null;
        map.set(slot.id, cropped);
      })
    )
  );

  return map;
}
