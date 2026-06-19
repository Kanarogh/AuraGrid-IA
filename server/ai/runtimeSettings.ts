import fs from "fs/promises";
import path from "path";
import type { AiProviderId } from "./types";
import { isLocalAiAllowed } from "../config/deploy";
import { sanitizeOpenRouterModelId } from "./openrouterModels";
import { sanitizeGeminiModelId } from "./geminiModels";
import { sanitizeOllamaModelId } from "./ollamaModels";

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
      await persist();
    }

    if (rawModel && openrouterModel && rawModel !== openrouterModel) {
      await persist();
    }
    if (rawGemini && geminiModel && rawGemini !== geminiModel) {
      await persist();
    }
    if (rawGeminiCatalog && geminiCatalogModel && rawGeminiCatalog !== geminiCatalogModel) {
      await persist();
    }
    if (rawOllama && ollamaModel && rawOllama !== ollamaModel) {
      await persist();
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
  return runtime.provider;
}

export function getRuntimeOpenRouterModel(): string | null {
  return runtime.openrouterModel;
}

export function getRuntimeGeminiModel(): string | null {
  return runtime.geminiModel;
}

export function getRuntimeGeminiCatalogModel(): string | null {
  return runtime.geminiCatalogModel;
}

export function getRuntimeOllamaModel(): string | null {
  return runtime.ollamaModel;
}

async function persist(): Promise<void> {
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
  runtime.provider = provider;
  await persist();
}

export async function setRuntimeOpenRouterModel(model: string | null): Promise<void> {
  runtime.openrouterModel = model && model.trim() ? model.trim() : null;
  await persist();
}

export async function setRuntimeGeminiModel(model: string | null): Promise<void> {
  runtime.geminiModel = model ? sanitizeGeminiModelId(model) : null;
  await persist();
}

export async function setRuntimeGeminiCatalogModel(model: string | null): Promise<void> {
  runtime.geminiCatalogModel = model ? sanitizeGeminiModelId(model) : null;
  await persist();
}

export async function setRuntimeOllamaModel(model: string | null): Promise<void> {
  runtime.ollamaModel = model ? sanitizeOllamaModelId(model) : null;
  await persist();
}

