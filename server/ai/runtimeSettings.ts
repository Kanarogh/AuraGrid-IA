import fs from "fs/promises";
import path from "path";
import type { AiProviderId } from "./types.ts";
import { sanitizeOpenRouterModelId } from "./openrouterModels.ts";

const SETTINGS_FILE = path.join(process.cwd(), ".auragrid-ai.json");

type RuntimeState = {
  provider: AiProviderId | null;
  openrouterModel: string | null;
};

let runtime: RuntimeState = { provider: null, openrouterModel: null };

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
    };
    const rawModel =
      typeof data.openrouterModel === "string" && data.openrouterModel.trim()
        ? data.openrouterModel.trim()
        : null;
    const openrouterModel = rawModel ? sanitizeOpenRouterModelId(rawModel) : null;

    const savedProvider =
      data.provider === "deepseek" ? null : isValidProvider(data.provider) ? data.provider : null;

    runtime = {
      provider: savedProvider,
      openrouterModel,
    };

    if (data.provider === "deepseek") {
      await persist();
    }

    if (rawModel && openrouterModel && rawModel !== openrouterModel) {
      await persist();
    }
  } catch {
    runtime = { provider: null, openrouterModel: null };
  }
}

export function getRuntimeProviderOverride(): AiProviderId | null {
  return runtime.provider;
}

export function getRuntimeOpenRouterModel(): string | null {
  return runtime.openrouterModel;
}

async function persist(): Promise<void> {
  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(
      {
        provider: runtime.provider,
        openrouterModel: runtime.openrouterModel,
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
