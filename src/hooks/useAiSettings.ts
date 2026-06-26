import { useSyncExternalStore } from "react";
import type { AiProviderId } from "../lib/aiSettings";
import {
  changeAiProvider,
  changeGeminiCatalogModel,
  changeGeminiContentScheduleModel,
  changeGeminiIndexingModel,
  changeGeminiModel,
  changeGeminiPlanningModel,
  changeGeminiReferenceModel,
  resetClientGeminiModelsToEnv,
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
    setGeminiPlanningModel: changeGeminiPlanningModel,
    setGeminiIndexingModel: changeGeminiIndexingModel,
    setGeminiContentScheduleModel: changeGeminiContentScheduleModel,
    setGeminiReferenceModel: changeGeminiReferenceModel,
    resetModelsToEnv: resetClientGeminiModelsToEnv,
  };
}

export type { AiProviderId };
