import type { AppSection } from "../../components/layout/AppSidebar";
import type { BrandGem, CanvaGridPage, CatalogItem, PlannedPost } from "../../types";

export const REGISTRY_KEY = "auragrid_client_registry";
export const WORKSPACE_KEY_PREFIX = "auragrid_ws:";

export type ClientMeta = {
  id: string;
  name: string;
  /** @ opcional; default: id sem hífens */
  instagramHandle?: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientRegistry = {
  version: 1;
  activeClientId: string;
  clients: ClientMeta[];
};

export type ClientWorkspace = {
  version: 1;
  brandGem: BrandGem;
  catalog: CatalogItem[];
  posts: PlannedPost[];
  startDate: string;
  canva: {
    pages: CanvaGridPage[];
    activePageId: string;
    autoSync: boolean;
    reversed: boolean;
  };
  ui?: {
    activeSection?: AppSection;
    activePreviewId?: string;
    viewMode?: "split" | "editorial";
  };
};

export function workspaceStorageKey(clientId: string): string {
  return `${WORKSPACE_KEY_PREFIX}${clientId}`;
}
