import { jsPDF } from "jspdf";
import type { CanvaGridPage } from "../types";
import type { CanvaGridFormat } from "./canvaGridFormats";

const COLS = 3;
const ROWS = 4;
const SLOTS_PER_PAGE = COLS * ROWS;
/** Largura de cada célula em pt — mesmo padrão do export Canva (810×N por slot). */
const CELL_W_PT = 810;
const CROP_PX = 1080;

function imageFormat(dataUrl: string): "JPEG" | "PNG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

/** Recorta imagem para a proporção do slot (cover). */
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
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Página vertical 3×4 sem margens — ex.: 4:5 → 2430×4050 pt (Grid MIA JUN 26). */
function gridPageLayout(formatMeta: CanvaGridFormat): {
  pageW: number;
  pageH: number;
  cellW: number;
  cellH: number;
} {
  const cellH = CELL_W_PT / formatMeta.aspectRatio;
  return {
    pageW: COLS * CELL_W_PT,
    pageH: ROWS * cellH,
    cellW: CELL_W_PT,
    cellH,
  };
}

export async function buildCanvaGridPdf(options: {
  pages: CanvaGridPage[];
  brandName: string;
  formatMeta: CanvaGridFormat;
  imagesBySlotId: Map<string, string | null>;
}): Promise<jsPDF> {
  const { pages, brandName, formatMeta, imagesBySlotId } = options;
  const { pageW, pageH, cellW, cellH } = gridPageLayout(formatMeta);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [pageW, pageH],
    compress: true,
  });

  pdf.setProperties({
    title: `Grid — ${brandName}`,
    subject: "Grid visual",
  });

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage([pageW, pageH], "portrait");
    }

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, pageH, "F");

    page.slots.slice(0, SLOTS_PER_PAGE).forEach((slot, index) => {
      const imageDataUrl = imagesBySlotId.get(slot.id);
      if (!imageDataUrl) return;

      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const x = col * cellW;
      const y = row * cellH;

      pdf.addImage(imageDataUrl, imageFormat(imageDataUrl), x, y, cellW, cellH);
    });
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
