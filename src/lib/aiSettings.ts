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
  activePlanningModel: string;
  activeIndexingModel: string;
  activeContentScheduleModel: string;
  activeReferenceModel: string;
  envModel: string;
  envCatalogModel: string;
  envPlanningModel: string;
  envIndexingModel: string;
  envContentScheduleModel: string;
  envReferenceModel: string;
  runtimeModel: string | null;
  runtimeCatalogModel: string | null;
  runtimePlanningModel: string | null;
  runtimeIndexingModel: string | null;
  runtimeContentScheduleModel: string | null;
  runtimeReferenceModel: string | null;
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
  planningModel?: string | null;
  indexingModel?: string | null;
  contentScheduleModel?: string | null;
  referenceModel?: string | null;
}): Promise<AiSettingsResponse> {
  const res = await apiFetch("/api/ai/gemini-model", {
    method: "PUT",
    body: JSON.stringify(options),
  });
  return readApiJson(res);
}
