import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../db/client";
import { userAppearancePreferences } from "../db/schema";
import type { AppearanceAccentPayload } from "../validation/appearanceSchema";

export type UserAppearanceSettings = AppearanceAccentPayload & {
  theme: "light" | "dark";
  saved: boolean;
  updatedAt: string | null;
};

const DEFAULT_SETTINGS: UserAppearanceSettings = {
  accentId: "cobalto",
  theme: "light",
  customAccentLight: null,
  customAccentDark: null,
  saved: false,
  updatedAt: null,
};

function mapRow(row: typeof userAppearancePreferences.$inferSelect): UserAppearanceSettings {
  return {
    accentId: row.accentId as UserAppearanceSettings["accentId"],
    theme: row.theme === "dark" ? "dark" : "light",
    customAccentLight: row.customAccentLight,
    customAccentDark: row.customAccentDark,
    saved: true,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getUserAppearanceSettings(userId: string): Promise<UserAppearanceSettings> {
  if (!isDatabaseConfigured()) return { ...DEFAULT_SETTINGS };
  const db = getDb();
  const [row] = await db
    .select()
    .from(userAppearancePreferences)
    .where(eq(userAppearancePreferences.userId, userId))
    .limit(1);
  return row ? mapRow(row) : { ...DEFAULT_SETTINGS };
}

export async function saveUserAppearanceSettings(
  userId: string,
  patch: AppearanceAccentPayload
): Promise<UserAppearanceSettings> {
  if (!isDatabaseConfigured()) {
    return { ...DEFAULT_SETTINGS, ...patch, saved: false, updatedAt: null };
  }

  const db = getDb();
  const existing = await getUserAppearanceSettings(userId);
  const customAccentLight = patch.accentId === "custom" ? patch.customAccentLight ?? null : null;
  const customAccentDark = patch.accentId === "custom" ? patch.customAccentDark ?? null : null;

  const [row] = await db
    .insert(userAppearancePreferences)
    .values({
      userId,
      accentId: patch.accentId,
      theme: existing.theme,
      customAccentLight,
      customAccentDark,
    })
    .onConflictDoUpdate({
      target: userAppearancePreferences.userId,
      set: {
        accentId: patch.accentId,
        customAccentLight,
        customAccentDark,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row ? mapRow(row) : { ...DEFAULT_SETTINGS, ...patch, saved: true, updatedAt: new Date().toISOString() };
}
