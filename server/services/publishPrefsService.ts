import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../db/client";
import { clientPublishPrefs } from "../db/schema";
import {
  DEFAULT_SLOT_TEMPLATES,
  type SlotTemplates,
} from "../../src/lib/publish/suggestScheduleTimes";
import type { PublishPrefsPayload } from "../validation/publishSchema";

export type ClientPublishPrefs = PublishPrefsPayload;

const DEFAULT_PREFS: ClientPublishPrefs = {
  timezone: "America/Sao_Paulo",
  slotTemplates: DEFAULT_SLOT_TEMPLATES,
  defaultLeadMinutes: 15,
};

function mapRow(row: typeof clientPublishPrefs.$inferSelect): ClientPublishPrefs {
  return {
    timezone: row.timezone,
    slotTemplates: (row.slotTemplates as SlotTemplates) ?? DEFAULT_SLOT_TEMPLATES,
    defaultLeadMinutes: row.defaultLeadMinutes,
  };
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

export async function saveClientPublishPrefs(
  clientId: string,
  patch: PublishPrefsPayload
): Promise<ClientPublishPrefs> {
  if (!isDatabaseConfigured()) return patch;
  const db = getDb();
  const [row] = await db
    .insert(clientPublishPrefs)
    .values({
      clientId,
      timezone: patch.timezone,
      slotTemplates: patch.slotTemplates,
      defaultLeadMinutes: patch.defaultLeadMinutes,
    })
    .onConflictDoUpdate({
      target: clientPublishPrefs.clientId,
      set: {
        timezone: patch.timezone,
        slotTemplates: patch.slotTemplates,
        defaultLeadMinutes: patch.defaultLeadMinutes,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row ? mapRow(row) : patch;
}
