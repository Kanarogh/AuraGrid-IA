export type AiProviderId = "gemini" | "groq" | "deepseek" | "openrouter";

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
    /** Quando o provedor ativo é DeepSeek, qual IA faz visão (se houver). */
    visionDelegate?: AiProviderId | null;
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
    address?: string;
    contact?: string;
    hashtags?: string;
    extra?: string;
  };
};

export interface MatchGenerateInput {
  postImage: string;
  catalogItems?: { id: string; label: string; image: string }[];
  catalogProfiles?: { id: string; label: string; profile: Record<string, unknown> }[];
  /** Gem estilo Gemini (preferido) */
  brandGem?: BrandGemPayload;
  /** @deprecated use brandGem */
  promptContext?: string;
  /** @deprecated use brandGem.footer */
  repeatingText?: BrandGemPayload["footer"];
}

export interface MatchGenerateResult {
  matchedId: string | null;
  reasoning: string;
  caption: string;
  matchMode: "catalog_json" | "catalog_images";
}

export interface AiProvider {
  id: AiProviderId;
  getModel(): string;
  isConfigured(): boolean;
  enrichCatalogItem(input: CatalogEnrichInput): Promise<Record<string, unknown>>;
  matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult>;
  refineCaption(input: {
    currentCaption: string;
    instructions: string;
    brandGem?: BrandGemPayload;
    promptContext?: string;
    repeatingText?: MatchGenerateInput["repeatingText"];
  }): Promise<string>;
}
