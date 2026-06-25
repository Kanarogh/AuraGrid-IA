import type { CatalogRevision } from "../api/workspaceApi";

export type SyncDomain =
  | "catalog"
  | "workspace"
  | "brandGem"
  | "periods"
  | "registry";

export type SyncRevisionDto = {
  periodId: string;
  catalog: CatalogRevision;
  workspace: string;
  brandGem: string;
  periods: string;
  registry: string;
  clientUpdatedAt: string;
};

export type SyncRevisionTokens = {
  catalog: string;
  workspace: string;
  brandGem: string;
  periods: string;
  registry: string;
};

export function tokensFromSyncRevision(rev: SyncRevisionDto): SyncRevisionTokens {
  return {
    catalog: rev.catalog.revision,
    workspace: rev.workspace,
    brandGem: rev.brandGem,
    periods: rev.periods,
    registry: rev.registry,
  };
}

export const SYNC_DOMAIN_LABELS: Record<SyncDomain, string> = {
  catalog: "Catálogo",
  workspace: "Planejamento",
  brandGem: "Gem da marca",
  periods: "Planejamentos",
  registry: "Clientes",
};
