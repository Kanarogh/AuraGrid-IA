import type { AppSection } from "../../components/layout/AppSidebar";
import type { CanvaGridFormatId } from "../canvaGridFormats";
import type { BrandGem, CanvaGridPage, CatalogItem, PlannedPost } from "../../types";
import type { PlanningPeriod } from "../planningConstants";
import type { PeriodSnapshot } from "./planningPeriodLocal";
import type { DistributionPrefs } from "../smartDistribution";

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

export type PlanningPeriodEditMode = "active" | "view_archived" | "edit_archived";

export type ClientWorkspace = {
  version: 1;
  brandGem: BrandGem;
  catalog: CatalogItem[];
  posts: PlannedPost[];
  startDate: string;
  activePlanningPeriodId: string;
  planningPeriods: PlanningPeriod[];
  periodSnapshots?: Record<string, PeriodSnapshot>;
  isReadOnly?: boolean;
  periodEditMode?: PlanningPeriodEditMode;
  canva: {
    pages: CanvaGridPage[];
    activePageId: string;
    autoSync: boolean;
    reversed: boolean;
    /** Proporção dos slots: square, portrait, landscape, stories */
    gridFormat?: CanvaGridFormatId;
    /** Largura máxima do grid em px */
    gridMaxWidth?: number;
  };
  ui?: {
    activeSection?: AppSection;
    activePreviewId?: string;
    viewMode?: "split" | "editorial";
    /** ISO — último salvamento explícito do Gem deste cliente */
    brandGemSavedAt?: string;
    distributionPrefs?: DistributionPrefs;
  };
};

export function workspaceStorageKey(clientId: string): string {
  return `${WORKSPACE_KEY_PREFIX}${clientId}`;
}
