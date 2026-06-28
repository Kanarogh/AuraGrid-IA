import { eq } from "drizzle-orm";
import type { AiProviderId } from "../ai/types";
import { getDb, isDatabaseConfigured } from "../db/client";
import { userAiPreferences } from "../db/schema";

export type UserAiRuntimeSettings = {
  provider: AiProviderId | null;
  indexingModel: string | null;
  planningModel: string | null;
  contentScheduleModel: string | null;
  referenceModel: string | null;
  /** @deprecated legacy columns — kept for backfill reads */
  geminiModel: string | null;
  geminiCatalogModel: string | null;
};

const EMPTY_SETTINGS: UserAiRuntimeSettings = {
  provider: null,
  indexingModel: null,
  planningModel: null,
  contentScheduleModel: null,
  referenceModel: null,
  geminiModel: null,
  geminiCatalogModel: null,
};

function mapRow(row: typeof userAiPreferences.$inferSelect): UserAiRuntimeSettings {
  const planningModel = row.planningModel ?? row.geminiModel;
  const indexingModel = row.indexingModel ?? row.geminiCatalogModel;
  return {
    provider: null,
    planningModel,
    indexingModel,
    contentScheduleModel: row.contentScheduleModel ?? planningModel,
    referenceModel: row.referenceModel ?? planningModel,
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
  patch: Partial<
    Pick<
      UserAiRuntimeSettings,
      | "indexingModel"
      | "planningModel"
      | "contentScheduleModel"
      | "referenceModel"
      | "geminiModel"
      | "geminiCatalogModel"
    >
  >
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const existing = await getUserAiRuntimeSettings(userId);

  const next = {
    indexingModel:
      patch.indexingModel !== undefined ? patch.indexingModel : existing.indexingModel,
    planningModel:
      patch.planningModel !== undefined ? patch.planningModel : existing.planningModel,
    contentScheduleModel:
      patch.contentScheduleModel !== undefined
        ? patch.contentScheduleModel
        : existing.contentScheduleModel,
    referenceModel:
      patch.referenceModel !== undefined ? patch.referenceModel : existing.referenceModel,
    geminiModel: patch.planningModel !== undefined ? patch.planningModel : existing.geminiModel,
    geminiCatalogModel:
      patch.indexingModel !== undefined ? patch.indexingModel : existing.geminiCatalogModel,
  };

  await db
    .insert(userAiPreferences)
    .values({
      userId,
      geminiModel: next.geminiModel,
      geminiCatalogModel: next.geminiCatalogModel,
      indexingModel: next.indexingModel,
      planningModel: next.planningModel,
      contentScheduleModel: next.contentScheduleModel,
      referenceModel: next.referenceModel,
    })
    .onConflictDoUpdate({
      target: userAiPreferences.userId,
      set: {
        geminiModel: next.geminiModel,
        geminiCatalogModel: next.geminiCatalogModel,
        indexingModel: next.indexingModel,
        planningModel: next.planningModel,
        contentScheduleModel: next.contentScheduleModel,
        referenceModel: next.referenceModel,
        updatedAt: new Date(),
      },
    });
}
