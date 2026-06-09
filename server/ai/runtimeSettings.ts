import fs from "fs/promises";
import path from "path";
import type { AiProviderId } from "./types";
import { sanitizeOpenRouterModelId } from "./openrouterModels";
import { sanitizeGeminiModelId } from "./geminiModels";

const SETTINGS_FILE = path.join(process.cwd(), ".auragrid-ai.json");

type RuntimeState = {
  provider: AiProviderId | null;
  openrouterModel: string | null;
  geminiModel: string | null;
  geminiCatalogModel: string | null;
};

let runtime: RuntimeState = {
  provider: null,
  openrouterModel: null,
  geminiModel: null,
  geminiCatalogModel: null,
};

function isValidProvider(value: unknown): value is AiProviderId {
  return (
    value === "gemini" ||
    value === "groq" ||
    value === "openrouter" ||
    value === "ollama"
  );
}

export async function loadRuntimeAiSettings(): Promise<void> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    const data = JSON.parse(raw) as {
      provider?: unknown;
      openrouterModel?: unknown;
      geminiModel?: unknown;
      geminiCatalogModel?: unknown;
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

    const savedProvider =
      data.provider === "deepseek" ? null : isValidProvider(data.provider) ? data.provider : null;

    runtime = {
      provider: savedProvider,
      openrouterModel,
      geminiModel,
      geminiCatalogModel,
    };

    if (data.provider === "deepseek") {
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
  } catch {
    runtime = {
      provider: null,
      openrouterModel: null,
      geminiModel: null,
      geminiCatalogModel: null,
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

async function persist(): Promise<void> {
  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(
      {
        provider: runtime.provider,
        openrouterModel: runtime.openrouterModel,
        geminiModel: runtime.geminiModel,
        geminiCatalogModel: runtime.geminiCatalogModel,
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
