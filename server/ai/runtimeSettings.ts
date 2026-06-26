import fs from "fs/promises";
import path from "path";
import { sanitizeGeminiModelId } from "./geminiModels";
import { getUserAiContext, patchUserAiContext } from "./userAiContext";
import { saveUserAiRuntimeSettings } from "../services/userAiPreferencesService";
import { isDatabaseConfigured } from "../db/client";
import type { AiProviderId } from "./types";

const SETTINGS_FILE = path.join(process.cwd(), ".auragrid-ai.json");

type RuntimeState = {
  provider: AiProviderId | null;
  geminiModel: string | null;
  geminiCatalogModel: string | null;
};

let runtime: RuntimeState = {
  provider: null,
  geminiModel: null,
  geminiCatalogModel: null,
};

let settingsLoadPromise: Promise<void> | null = null;

export function ensureRuntimeAiSettingsLoaded(): Promise<void> {
  if (!settingsLoadPromise) {
    settingsLoadPromise = loadRuntimeAiSettings().catch((err) => {
      settingsLoadPromise = null;
      throw err;
    });
  }
  return settingsLoadPromise;
}

export async function loadRuntimeAiSettings(): Promise<void> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8");
    const data = JSON.parse(raw) as {
      provider?: unknown;
      geminiModel?: unknown;
      geminiCatalogModel?: unknown;
    };

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

    runtime = {
      provider: null,
      geminiModel,
      geminiCatalogModel,
    };

    const providerWasLegacy = data.provider != null && data.provider !== "gemini";
    if (providerWasLegacy || data.provider === "gemini") {
      await persistFile();
    }
    if (rawGemini && geminiModel && rawGemini !== geminiModel) {
      await persistFile();
    }
    if (rawGeminiCatalog && geminiCatalogModel && rawGeminiCatalog !== geminiCatalogModel) {
      await persistFile();
    }
  } catch {
    runtime = {
      provider: null,
      geminiModel: null,
      geminiCatalogModel: null,
    };
  }
}

export function getRuntimeProviderOverride(): AiProviderId | null {
  const userCtx = getUserAiContext();
  if (userCtx) return userCtx.provider;
  return runtime.provider;
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

async function persistUserOrFile(patch: {
  provider?: AiProviderId | null;
  geminiModel?: string | null;
  geminiCatalogModel?: string | null;
}): Promise<void> {
  const userCtx = getUserAiContext();
  if (userCtx && isDatabaseConfigured()) {
    await saveUserAiRuntimeSettings(userCtx.userId, patch);
    patchUserAiContext(patch);
    return;
  }
  if (patch.provider !== undefined) runtime.provider = patch.provider;
  if (patch.geminiModel !== undefined) runtime.geminiModel = patch.geminiModel;
  if (patch.geminiCatalogModel !== undefined) runtime.geminiCatalogModel = patch.geminiCatalogModel;
  await persistFile();
}

async function persistFile(): Promise<void> {
  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(
      {
        provider: runtime.provider,
        geminiModel: runtime.geminiModel,
        geminiCatalogModel: runtime.geminiCatalogModel,
      },
      null,
      2
    ),
    "utf-8"
  );
}

export async function setRuntimeProvider(_provider: AiProviderId): Promise<void> {
  await persistUserOrFile({ provider: null });
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

