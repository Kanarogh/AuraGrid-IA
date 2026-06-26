import type { PostVisualFingerprint } from "./postFingerprint";

export type AiProviderId = "gemini";

export interface AiProviderHealth {
  configured: boolean;
  model: string;
}

export interface AiCircuitState {
  inCooldown: boolean;
  cooldownUntil: number;
  lastError: string | null;
  failures: number;
}

export interface AiHealthResponse {
  status: string;
  provider: AiProviderId;
  model: string;
  keyConfigured: boolean;
  providers: Record<AiProviderId, AiProviderHealth>;
  apiVersion: number;
  features: {
    catalogEnrich: boolean;
    catalogJsonMatch: boolean;
    fallbackChain?: boolean;
  };
  circuitBreaker?: Record<AiProviderId, AiCircuitState>;
}

export type CatalogEnrichProgressStep = {
  phase: string;
  itemPercent: number;
  stepLabel?: string;
};

export interface CatalogEnrichInput {
  image: string;
  label: string;
  id: string;
  /** SKUs já indexadas para achar irmãs na Fase B (provider resolve labels após Fase A). */
  siblingCandidates?: Array<{ id: string; label: string; profile: Record<string, unknown> }>;
  /** Quando false, só Fase A (extração). Default true no Gemini. */
  deepIndexing?: boolean;
  /** Atualiza progresso fino (fases A/B) durante a indexação. */
  onProgress?: (step: CatalogEnrichProgressStep) => void;
}

export type BrandGemPayload = {
  id?: string;
  name?: string;
  description?: string;
  instructions?: string;
  footer?: {
    structure?: string;
    address?: string;
    contact?: string;
    hashtags?: string;
    extra?: string;
    customFields?: { id: string; label: string; text: string; after: string }[];
  };
  captionParams?: {
    maxTotalChars?: number;
    maxHookChars?: number;
    maxHookSentences?: number;
    emojiPolicy?: string;
    hookStyle?: string;
    includeReferenceWhenMatched?: boolean;
    avoidPriceMention?: boolean;
    salesTone?: string;
  };
};

export interface MatchGenerateInput {
  postImage: string;
  clientId?: string;
  catalogItems?: { id: string; label: string; image: string }[];
  catalogProfiles?: { id: string; label: string; profile: Record<string, unknown> }[];
  postFingerprint?: PostVisualFingerprint;
  matchOnly?: boolean;
  brandGem?: BrandGemPayload;
  promptContext?: string;
  repeatingText?: BrandGemPayload["footer"];
  regenerateCaption?: boolean;
  captionFromImageOnly?: boolean;
  recentHooks?: string[];
  diverseBatch?: boolean;
  matchRankHint?: MatchRankHint;
  sceneContext?: {
    setting?: string;
    tags?: string[];
    light?: string;
    mood?: string;
  };
}

export type MatchRankHint = {
  candidateId: string;
  candidateLabel: string;
  score: number;
  scoreGap: number;
};

export interface PostVisualAnalyzeInput {
  postImage: string;
  purpose?: "planning" | "reference";
}

export interface MatchGenerateResult {
  matchedId: string | null;
  reasoning: string;
  caption: string;
  matchMode:
    | "catalog_json"
    | "catalog_json_shortlist"
    | "catalog_json_ranker"
    | "catalog_json_ranker_fast"
    | "catalog_json_fingerprint_text"
    | "catalog_json_vision"
    | "catalog_images"
    | "image_only";
}

export interface MatchReferenceResult {
  matchedId: string | null;
  reasoning: string;
  matchMode:
    | "catalog_json"
    | "catalog_json_shortlist"
    | "catalog_json_ranker"
    | "catalog_json_ranker_fast"
    | "catalog_json_fingerprint_text"
    | "catalog_json_vision"
    | "catalog_images";
}

/** Detalhes compactos da peça casada — usados no prompt para ancorar a legenda em traços específicos. */
export interface MatchedGarmentDetails {
  motif?: string;
  layout?: string;
  back?: string;
  neck?: string;
  sleeve?: string;
  len?: string;
  skirt?: string;
  silhouette?: string;
  colors?: string[];
  anchors?: string[];
}

export interface CaptionOnlyInput {
  postImage: string;
  brandGem?: BrandGemPayload;
  promptContext?: string;
  repeatingText?: BrandGemPayload["footer"];
  sceneContext?: MatchGenerateInput["sceneContext"];
  matchedCatalogLabel?: string;
  matchedGarment?: MatchedGarmentDetails;
  regenerateCaption?: boolean;
  recentHooks?: string[];
}

export interface MatchFromFingerprintInput extends Omit<MatchGenerateInput, "postImage"> {
  postFingerprint: PostVisualFingerprint;
  postImage?: string;
}

export interface AiProvider {
  id: AiProviderId;
  getModel(): string;
  isConfigured(): boolean;
  enrichCatalogItem(input: CatalogEnrichInput): Promise<Record<string, unknown>>;
  analyzePostVisual(input: PostVisualAnalyzeInput): Promise<PostVisualFingerprint>;
  matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult>;
  matchFromFingerprint(input: MatchFromFingerprintInput): Promise<MatchGenerateResult>;
  generateCaptionOnly(input: CaptionOnlyInput): Promise<{ caption: string }>;
  refineCaption(input: {
    currentCaption: string;
    instructions: string;
    brandGem?: BrandGemPayload;
    promptContext?: string;
    repeatingText?: MatchGenerateInput["repeatingText"];
  }): Promise<string>;
}
