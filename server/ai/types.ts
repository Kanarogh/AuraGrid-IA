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
  /** Só servidor — shortlist por embedding no Postgres */
  clientId?: string;
  catalogItems?: { id: string; label: string; image: string }[];
  catalogProfiles?: { id: string; label: string; profile: Record<string, unknown> }[];
  /** Só servidor — preenchido por prepareMatchInput */
  postFingerprint?: PostVisualFingerprint;
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
  /** Lote em curso com vários ganchos — pedir ângulo novo mesmo na 1ª geração */
  diverseBatch?: boolean;
  /** Hint do ranker visual (fingerprint) — só servidor */
  matchRankHint?: MatchRankHint;
  /** Cenário do post para legenda — só servidor */
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

export interface CaptionOnlyInput {
  postImage: string;
  brandGem?: BrandGemPayload;
  promptContext?: string;
  repeatingText?: BrandGemPayload["footer"];
  sceneContext?: MatchGenerateInput["sceneContext"];
  matchedCatalogLabel?: string;
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
  /** 1 imagem → JSON leve para ranquear o catálogo localmente (sem enviar todo o acervo à IA). */
  analyzePostVisual(input: PostVisualAnalyzeInput): Promise<PostVisualFingerprint>;
  matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult>;
  /** Match texto-only: fingerprint JSON × perfis (sem imagem do post). */
  matchFromFingerprint(input: MatchFromFingerprintInput): Promise<MatchGenerateResult>;
  /** Legenda com 1 imagem — sem JSON de catálogo. */
  generateCaptionOnly(input: CaptionOnlyInput): Promise<{ caption: string }>;
  refineCaption(input: {
    currentCaption: string;
    instructions: string;
    brandGem?: BrandGemPayload;
    promptContext?: string;
    repeatingText?: MatchGenerateInput["repeatingText"];
  }): Promise<string>;
}
