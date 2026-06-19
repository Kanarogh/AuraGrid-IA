import { eq } from "drizzle-orm";
import type { AiProviderId } from "../ai/types";
import { getDb, isDatabaseConfigured } from "../db/client";
import { userAiPreferences } from "../db/schema";

export type UserAiRuntimeSettings = {
  provider: AiProviderId | null;
  openrouterModel: string | null;
  geminiModel: string | null;
  geminiCatalogModel: string | null;
  ollamaModel: string | null;
};

const EMPTY_SETTINGS: UserAiRuntimeSettings = {
  provider: null,
  openrouterModel: null,
  geminiModel: null,
  geminiCatalogModel: null,
  ollamaModel: null,
};

function isValidProvider(value: unknown): value is AiProviderId {
  return (
    value === "gemini" ||
    value === "groq" ||
    value === "openrouter" ||
    value === "ollama"
  );
}

function mapRow(row: typeof userAiPreferences.$inferSelect): UserAiRuntimeSettings {
  return {
    provider: isValidProvider(row.activeProvider) ? row.activeProvider : null,
    openrouterModel: row.openrouterModel,
    geminiModel: row.geminiModel,
    geminiCatalogModel: row.geminiCatalogModel,
    ollamaModel: row.ollamaModel,
  };
}

export async function getUserAiRuntimeSettings(
  userId: string
): Promise<UserAiRuntimeSettings> {
  if (!isDatabaseConfigured()) return { ...EMPTY_SETTINGS };
  const db = getDb();
  const [row] = await db
    .select()
    .from(userAiPreferences)
    .where(eq(userAiPreferences.userId, userId))
    .limit(1);
  return row ? mapRow(row) : { ...EMPTY_SETTINGS };
}

export async function saveUserAiRuntimeSettings(
  userId: string,
  patch: Partial<UserAiRuntimeSettings>
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const existing = await getUserAiRuntimeSettings(userId);

  const next: UserAiRuntimeSettings = {
    provider: patch.provider !== undefined ? patch.provider : existing.provider,
    openrouterModel:
      patch.openrouterModel !== undefined ? patch.openrouterModel : existing.openrouterModel,
    geminiModel: patch.geminiModel !== undefined ? patch.geminiModel : existing.geminiModel,
    geminiCatalogModel:
      patch.geminiCatalogModel !== undefined
        ? patch.geminiCatalogModel
        : existing.geminiCatalogModel,
    ollamaModel: patch.ollamaModel !== undefined ? patch.ollamaModel : existing.ollamaModel,
  };

  await db
    .insert(userAiPreferences)
    .values({
      userId,
      activeProvider: next.provider,
      openrouterModel: next.openrouterModel,
      geminiModel: next.geminiModel,
      geminiCatalogModel: next.geminiCatalogModel,
      ollamaModel: next.ollamaModel,
    })
    .onConflictDoUpdate({
      target: userAiPreferences.userId,
      set: {
        activeProvider: next.provider,
        openrouterModel: next.openrouterModel,
        geminiModel: next.geminiModel,
        geminiCatalogModel: next.geminiCatalogModel,
        ollamaModel: next.ollamaModel,
        updatedAt: new Date(),
      },
    });
}
