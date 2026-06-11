import type { CanvaGridPage } from "../types";
import type { CanvaGridFormat } from "./canvaGridFormats";
import {
  buildCanvaGridPdf,
  prepareCanvaGridImagesForPdf,
} from "./buildCanvaGridPdfNative";
import { fetchImageAsDataUrl, resolveMediaUrl } from "./api/workspaceApi";

async function resolveSlotImage(src: string): Promise<string | null> {
  const resolved = resolveMediaUrl(src) ?? src;
  if (!resolved) return null;
  if (resolved.startsWith("/api/")) {
    try {
      return await fetchImageAsDataUrl(resolved);
    } catch {
      return null;
    }
  }
  return resolved;
}

export type CanvaGridPdfScope = "active" | "all";

export async function exportCanvaGridPdf(options: {
  pages: CanvaGridPage[];
  activePageId: string;
  scope: CanvaGridPdfScope;
  brandName: string;
  clientSlug?: string;
  formatMeta: CanvaGridFormat;
}): Promise<void> {
  const { pages, activePageId, scope, brandName, clientSlug, formatMeta } = options;

  const selectedPages =
    scope === "active"
      ? pages.filter((p) => p.id === activePageId)
      : pages.filter((p) => p.slots.some((s) => s.image));

  if (selectedPages.length === 0) {
    throw new Error("Nenhuma página do Grid Canva para exportar.");
  }

  if (!selectedPages.some((p) => p.slots.some((s) => s.image))) {
    throw new Error(
      scope === "active"
        ? "A página ativa não tem fotos nos slots."
        : "Nenhuma página do Grid Canva tem fotos para exportar."
    );
  }

  const imagesBySlotId = await prepareCanvaGridImagesForPdf(
    selectedPages,
    formatMeta.aspectRatio,
    resolveSlotImage
  );

  const pdf = await buildCanvaGridPdf({
    pages: selectedPages,
    brandName,
    formatMeta,
    imagesBySlotId,
  });

  const slug = (clientSlug || brandName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  const scopeLabel = scope === "active" ? "pagina-ativa" : "todas";
  pdf.save(`grid-canva-${slug || "marca"}-${scopeLabel}-${date}.pdf`);
}
