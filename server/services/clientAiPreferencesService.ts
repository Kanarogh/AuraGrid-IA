import type { ClientAiRuntimeSettings } from "./clientAiPreferencesTypes";
import {
  getUserAiRuntimeSettings,
  saveUserAiRuntimeSettings,
} from "./userAiPreferencesService";

export type { ClientAiRuntimeSettings } from "./clientAiPreferencesTypes";

/** @deprecated Prefer getUserAiRuntimeSettings — prefs are account-global. */
export async function getUserClientAiRuntimeSettings(
  userId: string,
  _clientId: string | null
): Promise<ClientAiRuntimeSettings> {
  const prefs = await getUserAiRuntimeSettings(userId);
  return {
    indexingModel: prefs.indexingModel,
    planningModel: prefs.planningModel,
    contentScheduleModel: prefs.contentScheduleModel,
    referenceModel: prefs.referenceModel,
  };
}

/** @deprecated Prefer saveUserAiRuntimeSettings — prefs are account-global. */
export async function saveUserClientAiRuntimeSettings(
  userId: string,
  _clientId: string,
  patch: Partial<ClientAiRuntimeSettings>
): Promise<void> {
  await saveUserAiRuntimeSettings(userId, patch);
}
