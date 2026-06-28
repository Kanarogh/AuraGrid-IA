import { META_PUBLISH_MOCK } from "../config/metaEnv";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../db/client";
import { clientPublishPrefs } from "../db/schema";
import {
  DEFAULT_SLOT_TEMPLATES,
  type SlotTemplates,
} from "../../src/lib/publish/suggestScheduleTimes";
import type { PublishPrefsPayload } from "../validation/publishSchema";

export type ClientPublishPrefs = PublishPrefsPayload & {
  autoScheduleOnDrop: boolean;
};

export type PublishPrefsResponse = ClientPublishPrefs & {
  publishMockEnabled: boolean;
};

const DEFAULT_PREFS: ClientPublishPrefs = {
  timezone: "America/Sao_Paulo",
  slotTemplates: DEFAULT_SLOT_TEMPLATES,
  defaultLeadMinutes: 15,
  autoScheduleOnDrop: false,
};

function mapRow(row: typeof clientPublishPrefs.$inferSelect): ClientPublishPrefs {
  return {
    timezone: row.timezone,
    slotTemplates: (row.slotTemplates as SlotTemplates) ?? DEFAULT_SLOT_TEMPLATES,
    defaultLeadMinutes: row.defaultLeadMinutes,
    autoScheduleOnDrop: row.autoScheduleOnDrop ?? false,
  };
}

export function isPublishMockEnabled(): boolean {
  return META_PUBLISH_MOCK;
}

export async function getClientPublishPrefs(clientId: string): Promise<ClientPublishPrefs> {
  if (!isDatabaseConfigured()) return { ...DEFAULT_PREFS };
  const db = getDb();
  const [row] = await db
    .select()
    .from(clientPublishPrefs)
    .where(eq(clientPublishPrefs.clientId, clientId))
    .limit(1);
  return row ? mapRow(row) : { ...DEFAULT_PREFS };
}

export async function getClientPublishPrefsPublic(clientId: string): Promise<PublishPrefsResponse> {
  const prefs = await getClientPublishPrefs(clientId);
  return { ...prefs, publishMockEnabled: isPublishMockEnabled() };
}

export async function saveClientPublishPrefs(
  clientId: string,
  patch: PublishPrefsPayload
): Promise<PublishPrefsResponse> {
  if (!isDatabaseConfigured()) {
    return {
      ...DEFAULT_PREFS,
      ...patch,
      autoScheduleOnDrop: patch.autoScheduleOnDrop ?? DEFAULT_PREFS.autoScheduleOnDrop,
      publishMockEnabled: isPublishMockEnabled(),
    };
  }
  const db = getDb();
  const existing = await getClientPublishPrefs(clientId);
  const merged: ClientPublishPrefs = {
    ...existing,
    ...patch,
    autoScheduleOnDrop: patch.autoScheduleOnDrop ?? existing.autoScheduleOnDrop,
  };
  const [row] = await db
    .insert(clientPublishPrefs)
    .values({
      clientId,
      timezone: merged.timezone,
      slotTemplates: merged.slotTemplates,
      defaultLeadMinutes: merged.defaultLeadMinutes,
      autoScheduleOnDrop: merged.autoScheduleOnDrop,
    })
    .onConflictDoUpdate({
      target: clientPublishPrefs.clientId,
      set: {
        timezone: merged.timezone,
        slotTemplates: merged.slotTemplates,
        defaultLeadMinutes: merged.defaultLeadMinutes,
        autoScheduleOnDrop: merged.autoScheduleOnDrop,
        updatedAt: new Date(),
      },
    })
    .returning();
  const saved = row ? mapRow(row) : merged;
  return { ...saved, publishMockEnabled: isPublishMockEnabled() };
}
