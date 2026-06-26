import { AsyncLocalStorage } from "async_hooks";
import type { AiProviderId } from "./types";
import {
  getUserClientAiRuntimeSettings,
  type ClientAiRuntimeSettings,
} from "../services/clientAiPreferencesService";
import { getActiveClientId } from "../services/clientService";

export type UserAiContextStore = ClientAiRuntimeSettings & {
  userId: string;
  clientId: string | null;
  provider: AiProviderId | null;
};

const userAiAls = new AsyncLocalStorage<UserAiContextStore>();

export function getUserAiContext(): UserAiContextStore | undefined {
  return userAiAls.getStore();
}

export function patchUserAiContext(patch: Partial<ClientAiRuntimeSettings>): void {
  const store = userAiAls.getStore();
  if (!store) return;
  if (patch.indexingModel !== undefined) store.indexingModel = patch.indexingModel;
  if (patch.planningModel !== undefined) store.planningModel = patch.planningModel;
  if (patch.contentScheduleModel !== undefined) {
    store.contentScheduleModel = patch.contentScheduleModel;
  }
  if (patch.referenceModel !== undefined) store.referenceModel = patch.referenceModel;
}

export async function withUserAiContext<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const clientId = await getActiveClientId(userId);
  const prefs = await getUserClientAiRuntimeSettings(userId, clientId);
  return userAiAls.run({ userId, clientId, provider: null, ...prefs }, fn);
}

export function isValidAiProvider(value: unknown): value is AiProviderId {
  return value === "gemini";
}
