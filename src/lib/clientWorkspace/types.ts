import type { AppSection } from "../../components/layout/AppSidebar";
import type { CanvaGridFormatId } from "../canvaGridFormats";
import type { BrandGem, CanvaGridPage, CatalogItem, ContentScheduleItem, PlannedPost } from "../../types";
import type { PlanningPeriod } from "../planningConstants";
import type { PeriodSnapshot } from "./planningPeriodLocal";
import type { DistributionPrefs } from "../smartDistribution";

import { STORAGE } from "../storageLegacy";

export const REGISTRY_KEY = STORAGE.registry;
export const WORKSPACE_KEY_PREFIX = STORAGE.workspacePrefix;

export type ClientMeta = {
  id: string;
  name: string;
  /** @ opcional; default: id sem hífens */
  instagramHandle?: string;
  /** Padrão do cliente: usar workflow de referências (indexação + match). Default true. */
  defaultUsesReferences?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClientRegistry = {
  version: 1;
  activeClientId: string;
  clients: ClientMeta[];
};

export type PlanningPeriodEditMode = "active" | "view_archived" | "edit_archived";

export type ContentScheduleOptions = {
  postCount: number;
  storyCount: number;
  extraInstructions: string;
};

export const DEFAULT_CONTENT_SCHEDULE_OPTIONS: ContentScheduleOptions = {
  postCount: 9,
  storyCount: 12,
  extraInstructions: "",
};

export type ClientWorkspace = {
  version: 1;
  brandGem: BrandGem;
  catalog: CatalogItem[];
  posts: PlannedPost[];
  contentSchedule: ContentScheduleItem[];
  /** Briefing do cronograma (por roteiro). */
  contentScheduleBrief?: string;
  /** Opções do gerador de cronograma (por roteiro). */
  contentScheduleOptions?: ContentScheduleOptions;
  startDate: string;
  activePlanningPeriodId: string;
  planningPeriods: PlanningPeriod[];
  periodSnapshots?: Record<string, PeriodSnapshot>;
  isReadOnly?: boolean;
  periodEditMode?: PlanningPeriodEditMode;
  /** Valor efetivo resolvido (cliente + override do roteiro). */
  usesReferences?: boolean;
  /** Padrão do cliente (espelhado do registry/API). */
  defaultUsesReferences?: boolean;
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
