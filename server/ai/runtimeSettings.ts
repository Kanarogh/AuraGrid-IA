import fs from "fs/promises";
import path from "path";
import type { AiProviderId } from "./types";
import { isLocalAiAllowed } from "../config/deploy";
import { sanitizeOpenRouterModelId } from "./openrouterModels";
import { sanitizeGeminiModelId } from "./geminiModels";
import { sanitizeOllamaModelId } from "./ollamaModels";
import { getUserAiContext, patchUserAiContext } from "./userAiContext";
import { saveUserAiRuntimeSettings } from "../services/userAiPreferencesService";
import { isDatabaseConfigured } from "../db/client";

const SETTINGS_FILE = path.join(process.cwd(), ".auragrid-ai.json");

type RuntimeState = {
  provider: AiProviderId | null;
  openrouterModel: string | null;
  geminiModel: string | null;
  geminiCatalogModel: string | null;
  ollamaModel: string | null;
};

let runtime: RuntimeState = {
  provider: null,
  openrouterModel: null,
  geminiModel: null,
  geminiCatalogModel: null,
  ollamaModel: null,
};

let settingsLoadPromise: Promise<void> | null = null;

/** Garante leitura de .auragrid-ai.json (hot-reload do dev zera o runtime em memória). */
export function ensureRuntimeAiSettingsLoaded(): Promise<void> {
  if (!settingsLoadPromise) {
    settingsLoadPromise = loadRuntimeAiSettings().catch((err) => {
      settingsLoadPromise = null;
      throw err;
    });
  }
  return settingsLoadPromise;
}

function isValidProvider(value: unknown): value is AiProviderId {
  return (
    value === "gemini" ||
    value === "groq" ||
    value === "openrouter" ||
    value === "ollama"
  );
}

function normalizeLegacyProvider(value: unknown): AiProviderId | null {
  if (value === "deepseek" || value === "openai" || value === "gpt") return null;
  return isValidProvider(value) ? value : null;
}

export async function loadRuntimeAiSettings(): Promise<void> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    const data = JSON.parse(raw) as {
      provider?: unknown;
      openrouterModel?: unknown;
      geminiModel?: unknown;
      geminiCatalogModel?: unknown;
      ollamaModel?: unknown;
      openaiModel?: unknown;
      openaiCatalogModel?: unknown;
    };
    const rawModel =
      typeof data.openrouterModel === "string" && data.openrouterModel.trim()
        ? data.openrouterModel.trim()
        : null;
    const openrouterModel = rawModel ? sanitizeOpenRouterModelId(rawModel) : null;

    const rawGemini =
      typeof data.geminiModel === "string" && data.geminiModel.trim()
        ? data.geminiModel.trim()
        : null;
    const geminiModel = rawGemini ? sanitizeGeminiModelId(rawGemini) : null;

    const rawGeminiCatalog =
      typeof data.geminiCatalogModel === "string" && data.geminiCatalogModel.trim()
        ? data.geminiCatalogModel.trim()
        : null;
    const geminiCatalogModel = rawGeminiCatalog
      ? sanitizeGeminiModelId(rawGeminiCatalog)
      : null;

    const rawOllama =
      typeof data.ollamaModel === "string" && data.ollamaModel.trim()
        ? data.ollamaModel.trim()
        : null;
    const ollamaModel = rawOllama ? sanitizeOllamaModelId(rawOllama) : null;

    const savedProvider = normalizeLegacyProvider(data.provider);
    const provider =
      savedProvider === "ollama" && !isLocalAiAllowed() ? null : savedProvider;

    runtime = {
      provider,
      openrouterModel,
      geminiModel,
      geminiCatalogModel,
      ollamaModel,
    };

    const legacy =
      data.provider === "deepseek" ||
      data.provider === "openai" ||
      data.provider === "gpt" ||
      "openaiModel" in data ||
      "openaiCatalogModel" in data;

    if (legacy || (savedProvider === "ollama" && !provider)) {
      await persistFile();
    }

    if (rawModel && openrouterModel && rawModel !== openrouterModel) {
      await persistFile();
    }
    if (rawGemini && geminiModel && rawGemini !== geminiModel) {
      await persistFile();
    }
    if (rawGeminiCatalog && geminiCatalogModel && rawGeminiCatalog !== geminiCatalogModel) {
      await persistFile();
    }
    if (rawOllama && ollamaModel && rawOllama !== ollamaModel) {
      await persistFile();
    }
  } catch {
    runtime = {
      provider: null,
      openrouterModel: null,
      geminiModel: null,
      geminiCatalogModel: null,
      ollamaModel: null,
    };
  }
}

export function getRuntimeProviderOverride(): AiProviderId | null {
  const userCtx = getUserAiContext();
  if (userCtx) return userCtx.provider;
  return runtime.provider;
}

export function getRuntimeOpenRouterModel(): string | null {
  const userCtx = getUserAiContext();
  if (userCtx) return userCtx.openrouterModel;
  return runtime.openrouterModel;
}

export function getRuntimeGeminiModel(): string | null {
  const userCtx = getUserAiContext();
  if (userCtx) return userCtx.geminiModel;
  return runtime.geminiModel;
}

export function getRuntimeGeminiCatalogModel(): string | null {
  const userCtx = getUserAiContext();
  if (userCtx) return userCtx.geminiCatalogModel;
  return runtime.geminiCatalogModel;
}

export function getRuntimeOllamaModel(): string | null {
  const userCtx = getUserAiContext();
  if (userCtx) return userCtx.ollamaModel;
  return runtime.ollamaModel;
}

async function persistUserOrFile(patch: {
  provider?: AiProviderId | null;
  openrouterModel?: string | null;
  geminiModel?: string | null;
  geminiCatalogModel?: string | null;
  ollamaModel?: string | null;
}): Promise<void> {
  const userCtx = getUserAiContext();
  if (userCtx && isDatabaseConfigured()) {
    await saveUserAiRuntimeSettings(userCtx.userId, patch);
    patchUserAiContext(patch);
    return;
  }
  if (patch.provider !== undefined) runtime.provider = patch.provider;
  if (patch.openrouterModel !== undefined) runtime.openrouterModel = patch.openrouterModel;
  if (patch.geminiModel !== undefined) runtime.geminiModel = patch.geminiModel;
  if (patch.geminiCatalogModel !== undefined) runtime.geminiCatalogModel = patch.geminiCatalogModel;
  if (patch.ollamaModel !== undefined) runtime.ollamaModel = patch.ollamaModel;
  await persistFile();
}

async function persistFile(): Promise<void> {
  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(
      {
        provider: runtime.provider,
        openrouterModel: runtime.openrouterModel,
        geminiModel: runtime.geminiModel,
        geminiCatalogModel: runtime.geminiCatalogModel,
        ollamaModel: runtime.ollamaModel,
      },
      null,
      2
    ),
    "utf-8"
  );
}

export async function setRuntimeProvider(provider: AiProviderId): Promise<void> {
  await persistUserOrFile({ provider });
}

export async function setRuntimeOpenRouterModel(model: string | null): Promise<void> {
  await persistUserOrFile({
    openrouterModel: model && model.trim() ? model.trim() : null,
  });
}

export async function setRuntimeGeminiModel(model: string | null): Promise<void> {
  await persistUserOrFile({
    geminiModel: model ? sanitizeGeminiModelId(model) : null,
  });
}

export async function setRuntimeGeminiCatalogModel(model: string | null): Promise<void> {
  await persistUserOrFile({
    geminiCatalogModel: model ? sanitizeGeminiModelId(model) : null,
  });
}

export async function setRuntimeOllamaModel(model: string | null): Promise<void> {
  await persistUserOrFile({
    ollamaModel: model ? sanitizeOllamaModelId(model) : null,
  });
}

