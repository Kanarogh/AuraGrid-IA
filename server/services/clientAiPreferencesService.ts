import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../db/client";
import { clientAiPreferences } from "../db/schema";
import { getUserAiRuntimeSettings } from "./userAiPreferencesService";

export type ClientAiRuntimeSettings = {
  indexingModel: string | null;
  planningModel: string | null;
  contentScheduleModel: string | null;
  referenceModel: string | null;
};

const EMPTY_SETTINGS: ClientAiRuntimeSettings = {
  indexingModel: null,
  planningModel: null,
  contentScheduleModel: null,
  referenceModel: null,
};

function mapRow(row: typeof clientAiPreferences.$inferSelect): ClientAiRuntimeSettings {
  return {
    indexingModel: row.indexingModel,
    planningModel: row.planningModel,
    contentScheduleModel: row.contentScheduleModel,
    referenceModel: row.referenceModel,
  };
}

async function fallbackFromLegacy(userId: string): Promise<ClientAiRuntimeSettings> {
  const legacy = await getUserAiRuntimeSettings(userId);
  return {
    indexingModel: legacy.geminiCatalogModel,
    planningModel: legacy.geminiModel,
    contentScheduleModel: legacy.geminiModel,
    referenceModel: legacy.geminiModel,
  };
}

export async function getUserClientAiRuntimeSettings(
  userId: string,
  clientId: string | null
): Promise<ClientAiRuntimeSettings> {
  if (!isDatabaseConfigured()) return { ...EMPTY_SETTINGS };

  if (!clientId) {
    return fallbackFromLegacy(userId);
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(clientAiPreferences)
    .where(and(eq(clientAiPreferences.userId, userId), eq(clientAiPreferences.clientId, clientId)))
    .limit(1);

  if (row) return mapRow(row);
  const fallback = await fallbackFromLegacy(userId);
  await db
    .insert(clientAiPreferences)
    .values({
      userId,
      clientId,
      indexingModel: fallback.indexingModel,
      planningModel: fallback.planningModel,
      contentScheduleModel: fallback.contentScheduleModel,
      referenceModel: fallback.referenceModel,
    })
    .onConflictDoNothing();
  return fallback;
}

export async function saveUserClientAiRuntimeSettings(
  userId: string,
  clientId: string,
  patch: Partial<ClientAiRuntimeSettings>
): Promise<void> {
  if (!isDatabaseConfigured()) return;

  const db = getDb();
  const existing = await getUserClientAiRuntimeSettings(userId, clientId);
  const next: ClientAiRuntimeSettings = {
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
  };

  await db
    .insert(clientAiPreferences)
    .values({
      userId,
      clientId,
      indexingModel: next.indexingModel,
      planningModel: next.planningModel,
      contentScheduleModel: next.contentScheduleModel,
      referenceModel: next.referenceModel,
    })
    .onConflictDoUpdate({
      target: [clientAiPreferences.userId, clientAiPreferences.clientId],
      set: {
        indexingModel: next.indexingModel,
        planningModel: next.planningModel,
        contentScheduleModel: next.contentScheduleModel,
        referenceModel: next.referenceModel,
        updatedAt: new Date(),
      },
    });
}
