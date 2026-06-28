import { AsyncLocalStorage } from "async_hooks";
import type { AiProviderId } from "./types";
import {
  getUserAiRuntimeSettings,
  saveUserAiRuntimeSettings,
  type UserAiRuntimeSettings,
} from "../services/userAiPreferencesService";
import { getActiveClientId } from "../services/clientService";

export type UserAiContextStore = Pick<
  UserAiRuntimeSettings,
  "indexingModel" | "planningModel" | "contentScheduleModel" | "referenceModel"
> & {
  userId: string;
  clientId: string | null;
  provider: AiProviderId | null;
};

const userAiAls = new AsyncLocalStorage<UserAiContextStore>();

export function getUserAiContext(): UserAiContextStore | undefined {
  return userAiAls.getStore();
}

export function patchUserAiContext(
  patch: Partial<
    Pick<
      UserAiRuntimeSettings,
      "indexingModel" | "planningModel" | "contentScheduleModel" | "referenceModel"
    >
  >
): void {
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
  const prefs = await getUserAiRuntimeSettings(userId);
  return userAiAls.run(
    {
      userId,
      clientId,
      provider: null,
      indexingModel: prefs.indexingModel,
      planningModel: prefs.planningModel,
      contentScheduleModel: prefs.contentScheduleModel,
      referenceModel: prefs.referenceModel,
    },
    fn
  );
}

export function isValidAiProvider(value: unknown): value is AiProviderId {
  return value === "gemini";
}
