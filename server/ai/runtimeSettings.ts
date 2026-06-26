import fs from "fs/promises";
import path from "path";
import { sanitizeGeminiModelId } from "./geminiModels";
import { getUserAiContext, patchUserAiContext } from "./userAiContext";
import { saveUserClientAiRuntimeSettings } from "../services/clientAiPreferencesService";
import { isDatabaseConfigured } from "../db/client";
import type { AiProviderId } from "./types";

const SETTINGS_FILE = path.join(process.cwd(), ".auragrid-ai.json");

type RuntimeState = {
  provider: AiProviderId | null;
  indexingModel: string | null;
  planningModel: string | null;
  contentScheduleModel: string | null;
  referenceModel: string | null;
};

let runtime: RuntimeState = {
  provider: null,
  indexingModel: null,
  planningModel: null,
  contentScheduleModel: null,
  referenceModel: null,
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
      indexingModel?: unknown;
      planningModel?: unknown;
      contentScheduleModel?: unknown;
      referenceModel?: unknown;
    };

    const rawIndexing =
      typeof data.indexingModel === "string" && data.indexingModel.trim()
        ? data.indexingModel.trim()
        : typeof data.geminiCatalogModel === "string" && data.geminiCatalogModel.trim()
          ? data.geminiCatalogModel.trim()
        : null;
    const indexingModel = rawIndexing ? sanitizeGeminiModelId(rawIndexing) : null;

    const rawPlanning =
      typeof data.planningModel === "string" && data.planningModel.trim()
        ? data.planningModel.trim()
        : typeof data.geminiModel === "string" && data.geminiModel.trim()
          ? data.geminiModel.trim()
        : null;
    const planningModel = rawPlanning ? sanitizeGeminiModelId(rawPlanning) : null;

    const rawContentSchedule =
      typeof data.contentScheduleModel === "string" && data.contentScheduleModel.trim()
        ? data.contentScheduleModel.trim()
        : rawPlanning;
    const contentScheduleModel = rawContentSchedule
      ? sanitizeGeminiModelId(rawContentSchedule)
      : null;

    const rawReference =
      typeof data.referenceModel === "string" && data.referenceModel.trim()
        ? data.referenceModel.trim()
        : rawPlanning;
    const referenceModel = rawReference ? sanitizeGeminiModelId(rawReference) : null;

    runtime = {
      provider: null,
      indexingModel,
      planningModel,
      contentScheduleModel,
      referenceModel,
    };

    const providerWasLegacy = data.provider != null && data.provider !== "gemini";
    if (providerWasLegacy || data.provider === "gemini") {
      await persistFile();
    }
    if (rawIndexing && indexingModel && rawIndexing !== indexingModel) {
      await persistFile();
    }
    if (rawPlanning && planningModel && rawPlanning !== planningModel) {
      await persistFile();
    }
    if (
      rawContentSchedule &&
      contentScheduleModel &&
      rawContentSchedule !== contentScheduleModel
    ) {
      await persistFile();
    }
    if (rawReference && referenceModel && rawReference !== referenceModel) {
      await persistFile();
    }
  } catch {
    runtime = {
      provider: null,
      indexingModel: null,
      planningModel: null,
      contentScheduleModel: null,
      referenceModel: null,
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
  if (userCtx) return userCtx.planningModel;
  return runtime.planningModel;
}

export function getRuntimeGeminiCatalogModel(): string | null {
  const userCtx = getUserAiContext();
  if (userCtx) return userCtx.indexingModel;
  return runtime.indexingModel;
}

export function getRuntimeGeminiPlanningModel(): string | null {
  return getRuntimeGeminiModel();
}

export function getRuntimeGeminiIndexingModel(): string | null {
  return getRuntimeGeminiCatalogModel();
}

export function getRuntimeGeminiContentScheduleModel(): string | null {
  const userCtx = getUserAiContext();
  if (userCtx) return userCtx.contentScheduleModel;
  return runtime.contentScheduleModel;
}

export function getRuntimeGeminiReferenceModel(): string | null {
  const userCtx = getUserAiContext();
  if (userCtx) return userCtx.referenceModel;
  return runtime.referenceModel;
}

async function persistUserOrFile(patch: {
  provider?: AiProviderId | null;
  indexingModel?: string | null;
  planningModel?: string | null;
  contentScheduleModel?: string | null;
  referenceModel?: string | null;
}): Promise<void> {
  const userCtx = getUserAiContext();
  if (userCtx && isDatabaseConfigured()) {
    if (!userCtx.clientId) {
      throw new Error(
        "Selecione um cliente ativo antes de salvar configuração de modelo por contexto."
      );
    }
    await saveUserClientAiRuntimeSettings(userCtx.userId, userCtx.clientId, patch);
    patchUserAiContext({
      indexingModel: patch.indexingModel,
      planningModel: patch.planningModel,
      contentScheduleModel: patch.contentScheduleModel,
      referenceModel: patch.referenceModel,
    });
    return;
  }
  if (patch.provider !== undefined) runtime.provider = patch.provider;
  if (patch.indexingModel !== undefined) runtime.indexingModel = patch.indexingModel;
  if (patch.planningModel !== undefined) runtime.planningModel = patch.planningModel;
  if (patch.contentScheduleModel !== undefined) {
    runtime.contentScheduleModel = patch.contentScheduleModel;
  }
  if (patch.referenceModel !== undefined) runtime.referenceModel = patch.referenceModel;
  await persistFile();
}

async function persistFile(): Promise<void> {
  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(
      {
        provider: runtime.provider,
        indexingModel: runtime.indexingModel,
        planningModel: runtime.planningModel,
        contentScheduleModel: runtime.contentScheduleModel,
        referenceModel: runtime.referenceModel,
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
    planningModel: model ? sanitizeGeminiModelId(model) : null,
  });
}

export async function setRuntimeGeminiCatalogModel(model: string | null): Promise<void> {
  await persistUserOrFile({
    indexingModel: model ? sanitizeGeminiModelId(model) : null,
  });
}

export async function setRuntimeGeminiPlanningModel(model: string | null): Promise<void> {
  await setRuntimeGeminiModel(model);
}

export async function setRuntimeGeminiIndexingModel(model: string | null): Promise<void> {
  await setRuntimeGeminiCatalogModel(model);
}

export async function setRuntimeGeminiContentScheduleModel(model: string | null): Promise<void> {
  await persistUserOrFile({
    contentScheduleModel: model ? sanitizeGeminiModelId(model) : null,
  });
}

export async function setRuntimeGeminiReferenceModel(model: string | null): Promise<void> {
  await persistUserOrFile({
    referenceModel: model ? sanitizeGeminiModelId(model) : null,
  });
}

