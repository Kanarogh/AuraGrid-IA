import type { PostVisualFingerprint } from "./postFingerprint";

export type AiProviderId = "gemini" | "groq" | "openrouter" | "ollama";

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

export interface CatalogEnrichInput {
  image: string;
  label: string;
  id: string;
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
  catalogItems?: { id: string; label: string; image: string }[];
  catalogProfiles?: { id: string; label: string; profile: Record<string, unknown> }[];
  /** Só identifica referência no catálogo — sem legenda (endpoint /api/match-reference). */
  matchOnly?: boolean;
  /** Gem estilo Gemini (preferido) */
  brandGem?: BrandGemPayload;
  /** @deprecated use brandGem */
  promptContext?: string;
  /** @deprecated use brandGem.footer */
  repeatingText?: BrandGemPayload["footer"];
  /** Usuário pediu nova legenda (ignorar cache + variar o gancho) */
  regenerateCaption?: boolean;
  /** Legenda só pelo conteúdo visual da imagem — sem match no catálogo */
  captionFromImageOnly?: boolean;
  /** Ganchos já usados no roteiro — a IA deve variar abertura e vocabulário */
  recentHooks?: string[];
  /** Hint do ranker visual (fingerprint) — só servidor */
  matchRankHint?: MatchRankHint;
}

export type MatchRankHint = {
  candidateId: string;
  candidateLabel: string;
  score: number;
  scoreGap: number;
};

export interface PostVisualAnalyzeInput {
  postImage: string;
}

export interface MatchGenerateResult {
  matchedId: string | null;
  reasoning: string;
  caption: string;
  matchMode:
    | "catalog_json"
    | "catalog_json_shortlist"
    | "catalog_json_ranker"
    | "catalog_images"
    | "image_only";
}

export interface MatchReferenceResult {
  matchedId: string | null;
  reasoning: string;
  matchMode: "catalog_json" | "catalog_json_shortlist" | "catalog_images";
}

export interface AiProvider {
  id: AiProviderId;
  getModel(): string;
  isConfigured(): boolean;
  enrichCatalogItem(input: CatalogEnrichInput): Promise<Record<string, unknown>>;
  /** 1 imagem → JSON leve para ranquear o catálogo localmente (sem enviar todo o acervo à IA). */
  analyzePostVisual(input: PostVisualAnalyzeInput): Promise<PostVisualFingerprint>;
  matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult>;
  refineCaption(input: {
    currentCaption: string;
    instructions: string;
    brandGem?: BrandGemPayload;
    promptContext?: string;
    repeatingText?: MatchGenerateInput["repeatingText"];
  }): Promise<string>;
}
