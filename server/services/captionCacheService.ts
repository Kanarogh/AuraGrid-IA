import { createHash } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { captionCacheEntries } from "../db/schema";

const MAX_ENTRIES = 200;

export type CaptionCacheValue = {
  caption: string;
  matchedId: string | null;
  reasoning: string | null;
  providerUsed?: string;
  matchMode?: string;
  cachedAt: number;
};

export function buildCacheKey(input: {
  imageDataUrl: string;
  postId?: string;
  captionFromImageOnly?: boolean;
  brandGem?: unknown;
  catalogIds?: string[];
}): string {
  const payload = JSON.stringify({
    image: input.imageDataUrl.slice(0, 512),
    postId: input.postId ?? "",
    imageOnly: !!input.captionFromImageOnly,
    brandGem: input.brandGem ?? null,
    catalogIds: (input.catalogIds ?? []).slice().sort(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export async function getCaptionCache(
  clientId: string,
  cacheKey: string
): Promise<CaptionCacheValue | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(captionCacheEntries)
    .where(
      and(eq(captionCacheEntries.clientId, clientId), eq(captionCacheEntries.cacheKey, cacheKey))
    )
    .limit(1);
  if (!row) return null;
  return {
    caption: row.caption,
    matchedId: row.matchedCatalogId,
    reasoning: row.reasoning,
    providerUsed: row.providerUsed ?? undefined,
    matchMode: row.matchMode ?? undefined,
    cachedAt: row.cachedAt.getTime(),
  };
}

export async function setCaptionCache(
  clientId: string,
  cacheKey: string,
  value: CaptionCacheValue
): Promise<void> {
  const db = getDb();
  await db
    .insert(captionCacheEntries)
    .values({
      clientId,
      cacheKey,
      caption: value.caption,
      matchedCatalogId: value.matchedId,
      reasoning: value.reasoning,
      providerUsed: value.providerUsed,
      matchMode: value.matchMode,
    })
    .onConflictDoUpdate({
      target: [captionCacheEntries.clientId, captionCacheEntries.cacheKey],
      set: {
        caption: value.caption,
        matchedCatalogId: value.matchedId,
        reasoning: value.reasoning,
        providerUsed: value.providerUsed,
        matchMode: value.matchMode,
        cachedAt: new Date(),
      },
    });

  const rows = await db
    .select({ id: captionCacheEntries.id })
    .from(captionCacheEntries)
    .where(eq(captionCacheEntries.clientId, clientId))
    .orderBy(desc(captionCacheEntries.cachedAt));

  if (rows.length > MAX_ENTRIES) {
    const toDrop = rows.slice(MAX_ENTRIES).map((r) => r.id);
    if (toDrop.length > 0) {
      const { inArray } = await import("drizzle-orm");
      await db
        .delete(captionCacheEntries)
        .where(
          and(eq(captionCacheEntries.clientId, clientId), inArray(captionCacheEntries.id, toDrop))
        );
    }
  }
}

export async function clearCaptionCache(clientId: string): Promise<void> {
  const db = getDb();
  await db.delete(captionCacheEntries).where(eq(captionCacheEntries.clientId, clientId));
}
