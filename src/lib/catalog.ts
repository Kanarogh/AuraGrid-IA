import type { CatalogItem } from "../types";

/** Itens importados automaticamente por Canva/calendário — não são referência de showroom */
function wasAutoImported(item: CatalogItem): boolean {
  const d = item.description?.toLowerCase() ?? "";
  return (
    d.includes("canva grid") ||
    d.includes("calendário de 30") ||
    d.includes("gerador de calendário")
  );
}

export function normalizeCatalogItem(item: CatalogItem): CatalogItem {
  if (item.isReference === true) return item;
  if (item.isReference === false) return item;
  return { ...item, isReference: !wasAutoImported(item) };
}

export function isReferenceCatalogItem(item: CatalogItem): boolean {
  return item.isReference !== false;
}

export function getReferenceCatalog(catalog: CatalogItem[]): CatalogItem[] {
  return catalog.filter(isReferenceCatalogItem);
}
