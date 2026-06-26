import { useSyncExternalStore } from "react";
import type { AiProviderId } from "../lib/aiSettings";
import {
  changeAiProvider,
  changeGeminiModel,
  changeGeminiCatalogModel,
  getActiveModelLabel,
  getActiveProviderOption,
  getApiStatusLabel,
  getConnectionStatus,
  getState,
  refreshAiSettings,
  subscribe,
} from "../lib/aiSettingsStore";

export function useAiSettings() {
  const state = useSyncExternalStore(subscribe, getState, getState);

  return {
    ...state,
    activeProvider: state.settings?.activeProvider ?? null,
    activeProviderOption: getActiveProviderOption(),
    activeModelLabel: getActiveModelLabel(),
    connectionStatus: getConnectionStatus(),
    apiStatusLabel: getApiStatusLabel(),
    refresh: refreshAiSettings,
    setProvider: changeAiProvider,
    setGeminiModel: changeGeminiModel,
    setGeminiCatalogModel: changeGeminiCatalogModel,
  };
}

export type { AiProviderId };
