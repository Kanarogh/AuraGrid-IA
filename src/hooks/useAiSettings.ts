import { useSyncExternalStore } from "react";
import type { AiProviderId } from "../lib/aiSettings";
import {
  changeAiProvider,
  changeOpenRouterModel,
  changeGeminiModel,
  changeGeminiCatalogModel,
  changeOllamaModel,
  getActiveModelLabel,
  getActiveProviderOption,
  getApiStatusLabel,
  getConnectionStatus,
  getState,
  refreshAiSettings,
  refreshOpenRouterModels,
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
    refreshOpenRouterModels,
    setProvider: changeAiProvider,
    setOpenRouterModel: changeOpenRouterModel,
    setGeminiModel: changeGeminiModel,
    setGeminiCatalogModel: changeGeminiCatalogModel,
    setOllamaModel: changeOllamaModel,
  };
}

export type { AiProviderId };
