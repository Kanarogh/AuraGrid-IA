import { META_PUBLISH_MOCK } from "../config/metaEnv";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../db/client";
import { clientPublishPrefs } from "../db/schema";
import {
  DEFAULT_PUBLISH_PLATFORMS,
  type PublishPlatform,
} from "../../src/lib/publish/platforms";
import {
  DEFAULT_SLOT_TEMPLATES,
  type SlotTemplates,
} from "../../src/lib/publish/suggestScheduleTimes";
import type { PublishPrefsPayload } from "../validation/publishSchema";

export type ClientPublishPrefs = PublishPrefsPayload & {
  autoScheduleOnDrop: boolean;
  defaultPlatforms: PublishPlatform[];
  pinterestDefaultBoardId: string | null;
};

export type PublishPrefsResponse = ClientPublishPrefs & {
  publishMockEnabled: boolean;
};

const DEFAULT_PREFS: ClientPublishPrefs = {
  timezone: "America/Sao_Paulo",
  slotTemplates: DEFAULT_SLOT_TEMPLATES,
  defaultLeadMinutes: 15,
  autoScheduleOnDrop: false,
  defaultPlatforms: [...DEFAULT_PUBLISH_PLATFORMS],
  pinterestDefaultBoardId: null,
};

function parseDefaultPlatforms(value: unknown): PublishPlatform[] {
  if (!Array.isArray(value) || !value.length) return [...DEFAULT_PUBLISH_PLATFORMS];
  const filtered = value.filter(
    (v): v is PublishPlatform =>
      typeof v === "string" &&
      (["instagram", "facebook", "linkedin", "pinterest"] as string[]).includes(v)
  );
  return filtered.length ? filtered : [...DEFAULT_PUBLISH_PLATFORMS];
}

function mapRow(row: typeof clientPublishPrefs.$inferSelect): ClientPublishPrefs {
  return {
    timezone: row.timezone,
    slotTemplates: (row.slotTemplates as SlotTemplates) ?? DEFAULT_SLOT_TEMPLATES,
    defaultLeadMinutes: row.defaultLeadMinutes,
    autoScheduleOnDrop: row.autoScheduleOnDrop ?? false,
    defaultPlatforms: parseDefaultPlatforms(row.defaultPlatforms),
    pinterestDefaultBoardId: row.pinterestDefaultBoardId ?? null,
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
      defaultPlatforms: patch.defaultPlatforms ?? DEFAULT_PREFS.defaultPlatforms,
      pinterestDefaultBoardId:
        patch.pinterestDefaultBoardId ?? DEFAULT_PREFS.pinterestDefaultBoardId,
      publishMockEnabled: isPublishMockEnabled(),
    };
  }
  const db = getDb();
  const existing = await getClientPublishPrefs(clientId);
  const merged: ClientPublishPrefs = {
    ...existing,
    ...patch,
    autoScheduleOnDrop: patch.autoScheduleOnDrop ?? existing.autoScheduleOnDrop,
    defaultPlatforms: patch.defaultPlatforms ?? existing.defaultPlatforms,
    pinterestDefaultBoardId:
      patch.pinterestDefaultBoardId !== undefined
        ? patch.pinterestDefaultBoardId
        : existing.pinterestDefaultBoardId,
  };
  const [row] = await db
    .insert(clientPublishPrefs)
    .values({
      clientId,
      timezone: merged.timezone,
      slotTemplates: merged.slotTemplates,
      defaultLeadMinutes: merged.defaultLeadMinutes,
      autoScheduleOnDrop: merged.autoScheduleOnDrop,
      defaultPlatforms: merged.defaultPlatforms,
      pinterestDefaultBoardId: merged.pinterestDefaultBoardId,
    })
    .onConflictDoUpdate({
      target: clientPublishPrefs.clientId,
      set: {
        timezone: merged.timezone,
        slotTemplates: merged.slotTemplates,
        defaultLeadMinutes: merged.defaultLeadMinutes,
        autoScheduleOnDrop: merged.autoScheduleOnDrop,
        defaultPlatforms: merged.defaultPlatforms,
        pinterestDefaultBoardId: merged.pinterestDefaultBoardId,
        updatedAt: new Date(),
      },
    })
    .returning();
  const saved = row ? mapRow(row) : merged;
  return { ...saved, publishMockEnabled: isPublishMockEnabled() };
}
