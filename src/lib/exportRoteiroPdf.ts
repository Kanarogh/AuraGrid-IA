import type { PlannedPost } from "../types";
import { buildRoteiroPdf } from "./buildRoteiroPdfNative";

function readAccentHex(): string {
  if (typeof document === "undefined") return "#7b5cff";
  const root = document.documentElement;
  const brand = getComputedStyle(root).getPropertyValue("--ag-brand-purple").trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(brand)) return brand;
  const raw = getComputedStyle(root).getPropertyValue("--ag-accent").trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw;
  return "#7b5cff";
}

export async function exportRoteiroPdf(options: {
  posts: PlannedPost[];
  brandName: string;
  startDate: string;
  clientSlug?: string;
}): Promise<void> {
  const { posts, brandName, startDate, clientSlug } = options;
  const withContent = posts.filter((p) => p.image || p.caption?.trim());
  if (withContent.length === 0) {
    throw new Error("Nenhum post com foto ou legenda para exportar.");
  }

  const pdf = await buildRoteiroPdf({
    posts,
    brandName,
    startDate,
    accentColor: readAccentHex(),
  });

  const slug = (clientSlug || brandName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  pdf.save(`roteiro-${slug || "marca"}-${date}.pdf`);
}
