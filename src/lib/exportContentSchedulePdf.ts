import type { ContentScheduleItem } from "../types";
import { buildContentSchedulePdf } from "./buildContentSchedulePdfNative";

function readAccentHex(): string {
  if (typeof document === "undefined") return "#7b5cff";
  const root = document.documentElement;
  const brand = getComputedStyle(root).getPropertyValue("--ag-brand-purple").trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(brand)) return brand;
  const raw = getComputedStyle(root).getPropertyValue("--ag-accent").trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw;
  return "#7b5cff";
}

export async function exportContentSchedulePdf(options: {
  items: ContentScheduleItem[];
  brandName: string;
  periodLabel: string;
  clientSlug?: string;
}): Promise<void> {
  const { items, brandName, periodLabel, clientSlug } = options;
  if (items.length === 0) {
    throw new Error("Nenhum item no cronograma para exportar.");
  }

  const pdf = await buildContentSchedulePdf({
    items,
    brandName,
    periodLabel,
    accentColor: readAccentHex(),
  });

  const slug = (clientSlug || brandName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const safePeriod = periodLabel.replace(/\s+/g, "-").toLowerCase();
  pdf.save(`cronograma-${slug || "marca"}-${safePeriod || "conteudo"}.pdf`);
}
