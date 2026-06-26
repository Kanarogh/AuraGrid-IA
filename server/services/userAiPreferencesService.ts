import { eq } from "drizzle-orm";
import type { AiProviderId } from "../ai/types";
import { getDb, isDatabaseConfigured } from "../db/client";
import { userAiPreferences } from "../db/schema";

export type UserAiRuntimeSettings = {
  provider: AiProviderId | null;
  geminiModel: string | null;
  geminiCatalogModel: string | null;
};

const EMPTY_SETTINGS: UserAiRuntimeSettings = {
  provider: null,
  geminiModel: null,
  geminiCatalogModel: null,
};

function mapRow(row: typeof userAiPreferences.$inferSelect): UserAiRuntimeSettings {
  return {
    provider: null,
    geminiModel: row.geminiModel,
    geminiCatalogModel: row.geminiCatalogModel,
  };
}

export async function getUserAiRuntimeSettings(userId: string): Promise<UserAiRuntimeSettings> {
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
    provider: null,
    geminiModel: patch.geminiModel !== undefined ? patch.geminiModel : existing.geminiModel,
    geminiCatalogModel:
      patch.geminiCatalogModel !== undefined
        ? patch.geminiCatalogModel
        : existing.geminiCatalogModel,
  };

  await db
    .insert(userAiPreferences)
    .values({
      userId,
      geminiModel: next.geminiModel,
      geminiCatalogModel: next.geminiCatalogModel,
    })
    .onConflictDoUpdate({
      target: userAiPreferences.userId,
      set: {
        geminiModel: next.geminiModel,
        geminiCatalogModel: next.geminiCatalogModel,
        updatedAt: new Date(),
      },
    });
}
