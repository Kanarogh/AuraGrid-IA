import {
  fetchAiSettings,
  providerDisplayName,
  setAiProvider,
  setGeminiModels,
  type AiProviderId,
  type AiSettingsResponse,
} from "./aiSettings";
import { geminiModelDisplayLabel } from "./geminiModelDisplay";

export type AiHealthSnapshot = {
  keyConfigured: boolean;
  catalogEnrich: boolean;
  provider: AiProviderId;
  model: string;
};

export type AiSettingsStoreState = {
  settings: AiSettingsResponse | null;
  health: AiHealthSnapshot | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  lastProviderUsed: AiProviderId | null;
};

const listeners = new Set<(state: AiSettingsStoreState) => void>();

let state: AiSettingsStoreState = {
  settings: null,
  health: null,
  loading: true,
  saving: false,
  error: null,
  lastProviderUsed: null,
};

function notify() {
  const snap = getState();
  listeners.forEach((l) => {
    try {
      l(snap);
    } catch (err) {
      console.error("aiSettingsStore listener error", err);
    }
  });
}

function setState(partial: Partial<AiSettingsStoreState>) {
  state = { ...state, ...partial };
  notify();
}

export function getState(): AiSettingsStoreState {
  return state;
}

export function subscribe(listener: (state: AiSettingsStoreState) => void): () => void {
  listeners.add(listener);
  listener(getState());
  return () => listeners.delete(listener);
}

async function fetchHealth(): Promise<AiHealthSnapshot | null> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return null;
    const data = await res.json();
    return {
      keyConfigured: data?.keyConfigured === true,
      catalogEnrich: data?.features?.catalogEnrich === true,
      provider: "gemini",
      model: typeof data?.model === "string" ? data.model : "—",
    };
  } catch {
    return null;
  }
}

export async function refreshAiSettings(): Promise<void> {
  setState({ loading: true, error: null });
  try {
    const [settings, health] = await Promise.all([fetchAiSettings(), fetchHealth()]);
    setState({ settings, health, loading: false, error: null });
  } catch (err) {
    setState({
      loading: false,
      error: err instanceof Error ? err.message : "Erro ao carregar IA.",
    });
  }
}

export async function changeAiProvider(provider: AiProviderId): Promise<void> {
  setState({ saving: true, error: null });
  try {
    const settings = await setAiProvider(provider);
    const health = await fetchHealth();
    setState({ settings, health, saving: false, lastProviderUsed: provider });
  } catch (err) {
    setState({
      saving: false,
      error: err instanceof Error ? err.message : "Falha ao aplicar configuração Gemini.",
    });
    throw err;
  }
}

export async function changeGeminiModel(model: string | null): Promise<void> {
  setState({ saving: true, error: null });
  try {
    const settings = await setGeminiModels({ model });
    const health = await fetchHealth();
    setState({ settings, health, saving: false });
  } catch (err) {
    setState({
      saving: false,
      error: err instanceof Error ? err.message : "Falha ao trocar modelo Gemini.",
    });
    throw err;
  }
}

export async function changeGeminiCatalogModel(catalogModel: string | null): Promise<void> {
  setState({ saving: true, error: null });
  try {
    const settings = await setGeminiModels({ catalogModel });
    setState({ settings, saving: false });
  } catch (err) {
    setState({
      saving: false,
      error: err instanceof Error ? err.message : "Falha ao trocar modelo de catálogo.",
    });
    throw err;
  }
}

export function noteLastProviderUsed(provider: string | null | undefined) {
  if (provider === "gemini") {
    setState({ lastProviderUsed: provider });
  }
}

export function getActiveProviderOption() {
  const { settings } = state;
  if (!settings) return null;
  return settings.providers.find((p) => p.id === settings.activeProvider) ?? null;
}

export function getActiveModelLabel(): string {
  const { settings } = state;
  if (!settings) return "—";
  return geminiModelDisplayLabel(settings.gemini);
}

export function getConnectionStatus(): "checking" | "connected" | "disconnected" {
  if (state.loading && !state.settings) return "checking";
  const active = getActiveProviderOption();
  if (active?.configured) return "connected";
  if (state.health?.keyConfigured) return "connected";
  return "disconnected";
}

export function getApiStatusLabel(): string {
  const status = getConnectionStatus();
  if (status === "checking") return "Verificando…";
  if (status === "disconnected") return "API não configurada";

  const name = providerDisplayName("gemini");
  const model = getActiveModelLabel();
  const shortModel = model.length > 28 ? `${model.slice(0, 25)}…` : model;
  return `IA conectada (${name}${shortModel !== "—" ? ` · ${shortModel}` : ""})`;
}

export function initAiSettingsStore() {
  void refreshAiSettings();
}
