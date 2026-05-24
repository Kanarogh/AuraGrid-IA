export type AiProviderId = "gemini" | "groq" | "deepseek" | "openrouter";

export interface AiProviderOption {
  id: AiProviderId;
  label: string;
  model: string;
  configured: boolean;
}

export interface OpenRouterModelOption {
  id: string;
  label: string;
  description: string;
  vision: boolean;
  recommended?: boolean;
  availableNow?: boolean;
  source?: "live" | "curated";
  visionText?: boolean;
  visionImage?: boolean;
  isFree?: boolean;
}

export interface OpenRouterSettings {
  activeModel: string;
  runtimeOverride: string | null;
  models: OpenRouterModelOption[];
  liveFetchedAt: string | null;
  liveCount: number;
}

export type OpenRouterModelsFilter = "vision-text" | "vision-image" | "vision-any";

export interface OpenRouterModelsListResponse {
  models: OpenRouterModelOption[];
  fetchedAt: string;
  fromCache: boolean;
  filter: OpenRouterModelsFilter;
  filterUrls?: {
    visionText: string;
    visionImage: string;
  };
  error?: string;
}

export interface AiSettingsResponse {
  activeProvider: AiProviderId;
  envDefaultProvider: AiProviderId;
  providers: AiProviderOption[];
  openrouter: OpenRouterSettings;
}

export function providerDisplayName(id: AiProviderId): string {
  if (id === "groq") return "Groq";
  if (id === "deepseek") return "DeepSeek";
  if (id === "openrouter") return "OpenRouter";
  return "Gemini";
}

export async function fetchAiSettings(refreshOpenRouter = false): Promise<AiSettingsResponse> {
  const q = refreshOpenRouter ? "?refresh=1" : "";
  const res = await fetch(`/api/ai/settings${q}`);
  if (!res.ok) throw new Error("Não foi possível carregar configurações de IA.");
  return res.json() as Promise<AiSettingsResponse>;
}

/** Lista modelos free com visão conforme filtros do site OpenRouter. */
export async function fetchOpenRouterModelsList(
  filter: OpenRouterModelsFilter = "vision-text",
  refresh = false
): Promise<OpenRouterModelsListResponse> {
  const params = new URLSearchParams({ filter });
  if (refresh) params.set("refresh", "1");
  const res = await fetch(`/api/ai/openrouter-models?${params}`);
  const data = (await res.json()) as OpenRouterModelsListResponse;
  if (!res.ok) throw new Error(data.error || "Falha ao listar modelos OpenRouter.");
  return data;
}

export async function setAiProvider(provider: AiProviderId): Promise<AiSettingsResponse> {
  const res = await fetch("/api/ai/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  const data = (await res.json()) as AiSettingsResponse & { error?: string };
  if (!res.ok) throw new Error(data.error || "Falha ao trocar provedor de IA.");
  return data;
}

/** Passe `null` para voltar ao modelo do .env (DEFAULT_OPENROUTER_MODEL). */
export async function setOpenRouterModel(
  model: string | null
): Promise<AiSettingsResponse> {
  const res = await fetch("/api/ai/openrouter-model", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  const data = (await res.json()) as AiSettingsResponse & { error?: string };
  if (!res.ok) throw new Error(data.error || "Falha ao trocar modelo OpenRouter.");
  return data;
}
