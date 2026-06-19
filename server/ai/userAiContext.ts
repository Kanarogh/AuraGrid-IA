import { AsyncLocalStorage } from "async_hooks";
import type { AiProviderId } from "./types";
import {
  getUserAiRuntimeSettings,
  type UserAiRuntimeSettings,
} from "../services/userAiPreferencesService";

export type UserAiContextStore = UserAiRuntimeSettings & { userId: string };

const userAiAls = new AsyncLocalStorage<UserAiContextStore>();

export function getUserAiContext(): UserAiContextStore | undefined {
  return userAiAls.getStore();
}

export function patchUserAiContext(patch: Partial<UserAiRuntimeSettings>): void {
  const store = userAiAls.getStore();
  if (!store) return;
  if (patch.provider !== undefined) store.provider = patch.provider;
  if (patch.openrouterModel !== undefined) store.openrouterModel = patch.openrouterModel;
  if (patch.geminiModel !== undefined) store.geminiModel = patch.geminiModel;
  if (patch.geminiCatalogModel !== undefined) store.geminiCatalogModel = patch.geminiCatalogModel;
  if (patch.ollamaModel !== undefined) store.ollamaModel = patch.ollamaModel;
}

export async function withUserAiContext<T>(
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  const prefs = await getUserAiRuntimeSettings(userId);
  return userAiAls.run({ userId, ...prefs }, fn);
}

export function isValidAiProvider(value: unknown): value is AiProviderId {
  return (
    value === "gemini" ||
    value === "groq" ||
    value === "openrouter" ||
    value === "ollama"
  );
}
