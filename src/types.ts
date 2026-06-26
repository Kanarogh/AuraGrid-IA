/** Perfil visual estruturado — gerado 1x ao subir referência; usado no match sem reenviar a imagem */
export interface CatalogVisualProfile {
  version: 1;
  referenceLabel: string;
  garmentType: string;
  category: string;
  primaryColors: string[];
  secondaryColors: string[];
  pattern: {
    type: string;
    description: string;
  };
  neckline: string;
  sleeves: string;
  dressLength: string;
  silhouette: string;
  fabricTexture: string;
  embellishments: string[];
  distinctiveDetails: string[];
  matchKeywords: string[];
  /** Resumo denso para comparação texto↔imagem */
  visualSummary: string;
  /** Uma linha única que diferencia este look dos demais do catálogo */
  distinguishingFingerprint: string;
  /** Cor dominante com tom específico (ex.: "verde-azulado/teal") */
  dominantColorFamily?: string;
  colorTemperature?: "warm" | "cool" | "neutral";
  printScale?: string;
  sleeveType?: string;
  lengthCategory?: string;
  /** Fatos visuais verificáveis para match preciso */
  matchAnchors?: string[];
  /** Como diferir de peças parecidas no catálogo */
  notToConfuseWith?: string;
}

export type CatalogEnrichmentStatus =
  | "pending"
  | "processing"
  | "ready"
  | "ready_limited"
  | "failed";

export interface CatalogItem {
  id: string;
  label: string; // e.g., "9146 Pink"
  image: string | null; // base64 or /api/v1/media URL
  imageAssetId?: string | null;
  imageUrl?: string;
  description?: string; // Optional metadata
  /** true = look de roupa (match IA); false = peça de grid/atmosfera (não indexada) */
  isReference?: boolean;
  /** v1 legado ou v2 compacto ({ version: 2, garment, scene }) */
  visualProfile?: CatalogVisualProfile | Record<string, unknown>;
  enrichmentStatus?: CatalogEnrichmentStatus;
  enrichedAt?: string;
  enrichmentError?: string;
}

import type { CaptionCustomField } from "./lib/captionFields";
import type { CaptionGenerationParams } from "./lib/captionParams";

export interface RepeatingText {
  /** Ordem dos blocos da legenda (opcional — complementa as regras padrão) */
  structure: string;
  address: string;
  contact: string;
  hashtags: string;
  extra: string;
  /** Blocos extras configuráveis (texto fixo inserido na legenda) */
  customFields?: CaptionCustomField[];
}

/** Perfil estilo Gemini Gems — preparado para vários clientes (id único por marca). */
export interface BrandGem {
  /** Identificador estável do cliente (ex.: palak-euro, cliente-b) */
  id: string;
  /** Nome do Gem / marca exibido na UI */
  name: string;
  /** Descrição curta do papel do assistente */
  description: string;
  /** Instruções completas (system prompt) enviadas à IA */
  instructions: string;
  /** Briefing da coleção/campanha do planejamento atual (muda a cada mês/coleção) */
  campaignContext?: string;
  /** Parâmetros de geração (limites, emojis, estilo do gancho) */
  captionParams?: CaptionGenerationParams;
  /** Endereço, hashtags, estrutura e rodapé fixos nas legendas */
  footer: RepeatingText;
}

/** Copy estruturado gerado no Cronograma de Conteúdo */
export type ContentScheduleSection = "posts" | "stories";

export type ContentScheduleItemStatus = "draft" | "approved" | "handed_off" | "done";

export interface ContentScheduleStoryExtras {
  pollOptions?: [string, string];
  onScreenText?: string;
}

export interface StructuredPostCopy {
  name: string;
  postType: string;
  section: ContentScheduleSection;
  headline: string;
  subtitle: string;
  cta: string;
  legenda: string;
  hashtags: string;
  storyExtras?: ContentScheduleStoryExtras;
}

export interface ContentScheduleItem extends StructuredPostCopy {
  id: string;
  order: number;
  scheduledDate?: string;
  status: ContentScheduleItemStatus;
  linkedPostId?: string;
}

export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface MatchCandidateSummary {
  id: string;
  label: string;
  score: number;
  pattern: number;
  anchors: number;
  penalty: number;
}

export interface MatchDiagnostics {
  confidence: MatchConfidence;
  chosenId: string | null;
  chosenLabel: string | null;
  chosenScore: number | null;
  scoreGap: number | null;
  topCandidates: MatchCandidateSummary[];
  rejectReasons: string[];
  /** Referência já conhecida — match visual não foi executado. */
  knownReference?: boolean;
  thresholds: {
    strict: { minScore: number; minGap: number };
    medium: { minScore: number; minGap: number };
  };
}

export interface PlannedPost {
  id: string;
  dayNumber: number;
  dateLabel: string; // e.g., "Segunda (23 de Mai)"
  image: string | null; // Base64 raw representation of the planned dress photograph
  imageAssetId?: string | null;
  matchedCatalogId: string | null; // Identified ID from the reference catalog items
  reasoning: string | null; // Reasoning provided by Gemini on why this matched
  caption: string; // Drafted Spanish caption
  isGenerating: boolean;
  isGenerated: boolean;
  isConfirmed?: boolean;
  error: string | null;
  /** Quando a foto vem do Canva Grid — evita duplicar base64 no localStorage */
  canvaSlotRef?: { pageId: string; slotId: string } | null;
  /** Arte/gráfico com texto — legenda pela imagem, sem comparar catálogo de vestidos */
  captionFromImageOnly?: boolean;
  /** Copy do cronograma vinculado a este dia */
  structuredCopy?: StructuredPostCopy;
  /** Legenda veio do cronograma — pedir confirmação antes de sobrescrever na IA */
  captionFromSchedule?: boolean;
  /** Modelo Gemini usado na última geração/refino da legenda */
  captionModel?: string | null;
  /** Diagnóstico do último match (confiança, top candidatos, motivo de rejeição) */
  matchDiagnostics?: MatchDiagnostics | null;
}

export interface CanvaGridSlot {
  id: string;
  image: string | null;
  imageAssetId?: string | null;
  label: string | null;
  matchedCatalogId: string | null;
}

export interface CanvaGridPage {
  id: string;
  name: string;
  slots: CanvaGridSlot[];
}
