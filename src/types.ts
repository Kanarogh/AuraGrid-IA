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
}

export type CatalogEnrichmentStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed";

export interface CatalogItem {
  id: string;
  label: string; // e.g., "9146 Pink"
  image: string; // base64 encoded photo
  description?: string; // Optional metadata
  /** Apenas itens do guarda-roupa (aba Catálogo) entram na lista e na IA de match */
  isReference?: boolean;
  visualProfile?: CatalogVisualProfile;
  enrichmentStatus?: CatalogEnrichmentStatus;
  enrichedAt?: string;
  enrichmentError?: string;
}

export interface RepeatingText {
  /** Ordem dos blocos da legenda (opcional — complementa as regras padrão) */
  structure: string;
  address: string;
  contact: string;
  hashtags: string;
  extra: string;
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
  /** Endereço, hashtags, estrutura e rodapé fixos nas legendas */
  footer: RepeatingText;
}

export interface PlannedPost {
  id: string;
  dayNumber: number;
  dateLabel: string; // e.g., "Segunda (23 de Mai)"
  image: string | null; // Base64 raw representation of the planned dress photograph
  matchedCatalogId: string | null; // Identified ID from the reference catalog items
  reasoning: string | null; // Reasoning provided by Gemini on why this matched
  caption: string; // Drafted Spanish caption
  isGenerating: boolean;
  isGenerated: boolean;
  isConfirmed?: boolean;
  error: string | null;
}

export interface CanvaGridSlot {
  id: string;
  image: string | null;
  label: string | null;
  matchedCatalogId: string | null;
}

export interface CanvaGridPage {
  id: string;
  name: string;
  slots: CanvaGridSlot[];
}
