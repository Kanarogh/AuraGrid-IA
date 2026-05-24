import {
  fetchAiSettings,
  providerDisplayName,
  setAiProvider,
  setOpenRouterModel,
  type AiProviderId,
  type AiSettingsResponse,
} from "./aiSettings";

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
  /** Provedor que respondeu na última chamada à API (header X-AI-Provider-Used). */
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
    const provider = data?.provider as AiProviderId | undefined;
    return {
      keyConfigured: data?.keyConfigured === true,
      catalogEnrich: data?.features?.catalogEnrich === true,
      provider:
        provider === "groq" ||
        provider === "deepseek" ||
        provider === "openrouter" ||
        provider === "gemini"
          ? provider
          : "gemini",
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
      error: err instanceof Error ? err.message : "Falha ao trocar provedor.",
    });
    throw err;
  }
}

export async function changeOpenRouterModel(model: string | null): Promise<void> {
  setState({ saving: true, error: null });
  try {
    const settings = await setOpenRouterModel(model);
    setState({ settings, saving: false });
  } catch (err) {
    setState({
      saving: false,
      error: err instanceof Error ? err.message : "Falha ao trocar modelo.",
    });
    throw err;
  }
}

export function noteLastProviderUsed(provider: string | null | undefined) {
  if (
    provider === "gemini" ||
    provider === "groq" ||
    provider === "deepseek" ||
    provider === "openrouter"
  ) {
    setState({ lastProviderUsed: provider });
  }
}

export function getActiveProviderOption() {
  const { settings } = state;
  if (!settings) return null;
  return settings.providers.find((p) => p.id === settings.activeProvider) ?? null;
}

/** Rótulo curto do modelo ativo (Gemini direto ou slug OpenRouter). */
export function getActiveModelLabel(): string {
  const { settings } = state;
  if (!settings) return "—";
  if (settings.activeProvider === "openrouter") {
    const id = settings.openrouter.activeModel;
    const known = settings.openrouter.models.find((m) => m.id === id);
    if (known) return known.label.replace(/ \(free\)/i, "");
    return id.replace(/^.*\//, "").replace(/:free$/, "");
  }
  const active = getActiveProviderOption();
  return active?.model ?? "—";
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

  const provider = state.settings?.activeProvider;
  if (!provider) return "IA conectada";

  const name = providerDisplayName(provider);
  const model = getActiveModelLabel();
  const shortModel =
    model.length > 28 ? `${model.slice(0, 25)}…` : model;

  if (state.lastProviderUsed && state.lastProviderUsed !== provider) {
    return `IA: ${name} · última resposta via ${providerDisplayName(state.lastProviderUsed)}`;
  }

  return `IA conectada (${name}${shortModel !== "—" ? ` · ${shortModel}` : ""})`;
}

/** Inicializa o store (chamar uma vez no App). */
export function initAiSettingsStore() {
  void refreshAiSettings();
}
