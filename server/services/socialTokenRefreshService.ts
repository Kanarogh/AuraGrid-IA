import { and, eq, lte, isNotNull } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../db/client";
import { clientMetaConnections, clientSocialConnections } from "../db/schema";
import { exchangeForLongLivedToken } from "./metaGraphClient";
import { decryptMetaToken, encryptMetaToken } from "./metaTokenCrypto";
import { refreshLinkedInToken } from "./linkedinGraphClient";
import { refreshPinterestToken } from "./pinterestGraphClient";

const REFRESH_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

export async function refreshExpiringSocialTokens(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();
  const threshold = new Date(Date.now() + REFRESH_WITHIN_MS);
  let refreshed = 0;

  const metaRows = await db
    .select()
    .from(clientMetaConnections)
    .where(
      and(
        eq(clientMetaConnections.status, "active"),
        isNotNull(clientMetaConnections.tokenExpiresAt),
        lte(clientMetaConnections.tokenExpiresAt, threshold)
      )
    );

  for (const row of metaRows) {
    try {
      const current = decryptMetaToken(row.accessTokenEnc);
      const long = await exchangeForLongLivedToken(current);
      const expiresAt =
        long.expires_in != null ? new Date(Date.now() + long.expires_in * 1000) : null;
      await db
        .update(clientMetaConnections)
        .set({
          accessTokenEnc: encryptMetaToken(long.access_token),
          tokenExpiresAt: expiresAt,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(clientMetaConnections.clientId, row.clientId));
      refreshed += 1;
    } catch (err) {
      console.warn(
        "[social-token-refresh] Meta",
        row.clientId,
        err instanceof Error ? err.message : err
      );
    }
  }

  const socialRows = await db
    .select()
    .from(clientSocialConnections)
    .where(
      and(
        eq(clientSocialConnections.status, "active"),
        isNotNull(clientSocialConnections.tokenExpiresAt),
        lte(clientSocialConnections.tokenExpiresAt, threshold)
      )
    );

  for (const row of socialRows) {
    if (!row.refreshTokenEnc) continue;
    try {
      const refreshToken = decryptMetaToken(row.refreshTokenEnc);
      if (row.platform === "linkedin") {
        const tokens = await refreshLinkedInToken(refreshToken);
        await db
          .update(clientSocialConnections)
          .set({
            accessTokenEnc: encryptMetaToken(tokens.access_token),
            refreshTokenEnc: encryptMetaToken(tokens.refresh_token ?? refreshToken),
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            status: "active",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(clientSocialConnections.clientId, row.clientId),
              eq(clientSocialConnections.platform, row.platform)
            )
          );
        refreshed += 1;
      } else if (row.platform === "pinterest") {
        const tokens = await refreshPinterestToken(refreshToken);
        await db
          .update(clientSocialConnections)
          .set({
            accessTokenEnc: encryptMetaToken(tokens.access_token),
            refreshTokenEnc: encryptMetaToken(tokens.refresh_token),
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            status: "active",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(clientSocialConnections.clientId, row.clientId),
              eq(clientSocialConnections.platform, row.platform)
            )
          );
        refreshed += 1;
      }
    } catch (err) {
      console.warn(
        "[social-token-refresh]",
        row.platform,
        row.clientId,
        err instanceof Error ? err.message : err
      );
    }
  }

  return refreshed;
}
