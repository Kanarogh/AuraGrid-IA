import { apiFetch, readApiJson } from "./api/apiClient";

export type AiProviderId = "gemini";

export interface AiProviderOption {
  id: AiProviderId;
  label: string;
  model: string;
  configured: boolean;
}

export interface GeminiModelOption {
  id: string;
  label: string;
  description: string;
  vision: boolean;
  forCatalog?: boolean;
  recommended?: boolean;
}

export interface GeminiSettings {
  activeModel: string;
  activeCatalogModel: string;
  envModel: string;
  envCatalogModel: string;
  runtimeModel: string | null;
  runtimeCatalogModel: string | null;
  models: GeminiModelOption[];
}

export interface AiSettingsResponse {
  activeProvider: AiProviderId;
  envDefaultProvider: AiProviderId;
  providers: AiProviderOption[];
  gemini: GeminiSettings;
}

export function providerDisplayName(_id: AiProviderId): string {
  return "Gemini";
}

export async function fetchAiSettings(): Promise<AiSettingsResponse> {
  const res = await apiFetch("/api/ai/settings");
  return readApiJson(res);
}

export async function setAiProvider(provider: AiProviderId): Promise<AiSettingsResponse> {
  const res = await apiFetch("/api/ai/settings", {
    method: "PUT",
    body: JSON.stringify({ provider }),
  });
  return readApiJson(res);
}

export async function setGeminiModels(options: {
  model?: string | null;
  catalogModel?: string | null;
}): Promise<AiSettingsResponse> {
  const res = await apiFetch("/api/ai/gemini-model", {
    method: "PUT",
    body: JSON.stringify(options),
  });
  return readApiJson(res);
}
