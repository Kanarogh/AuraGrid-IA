import { and, eq } from "drizzle-orm";
import type { PublishPlatform } from "../../src/lib/publish/platforms";
import { isMetaPlatform } from "../../src/lib/publish/platforms";
import { getDb, isDatabaseConfigured } from "../db/client";
import { clientSocialConnections } from "../db/schema";
import { decryptMetaToken, encryptMetaToken } from "./metaTokenCrypto";
import { getMetaConnectionPublic, type MetaConnectionPublic } from "./metaConnectionService";

export type SocialConnectionPublic = {
  platform: PublishPlatform;
  connected: boolean;
  status: "active" | "expired" | "revoked" | "disconnected";
  displayName: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  needsReconnect: boolean;
  metadata: Record<string, unknown>;
  oauthConfigured: boolean;
};

export type SocialConnectionWithToken = SocialConnectionPublic & {
  accessToken: string;
  refreshToken: string | null;
};

function mapSocialRow(
  platform: PublishPlatform,
  row: typeof clientSocialConnections.$inferSelect,
  oauthConfigured: boolean
): SocialConnectionPublic {
  const expired =
    row.tokenExpiresAt != null && row.tokenExpiresAt.getTime() <= Date.now();
  const status =
    row.status === "revoked"
      ? "revoked"
      : expired || row.status === "expired"
        ? "expired"
        : "active";
  const metadata = (row.metadata as Record<string, unknown>) ?? {};
  return {
    platform,
    connected: true,
    status,
    displayName:
      (metadata.displayName as string) ??
      (metadata.organizationName as string) ??
      (metadata.username as string) ??
      null,
    tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
    connectedAt: row.connectedAt.toISOString(),
    needsReconnect: status !== "active",
    metadata,
    oauthConfigured,
  };
}

function metaAsSocial(platform: PublishPlatform, meta: MetaConnectionPublic): SocialConnectionPublic {
  const connected = meta.connected && meta.status === "active";
  return {
    platform,
    connected,
    status: meta.status === "disconnected" ? "disconnected" : meta.status,
    displayName:
      platform === "instagram"
        ? meta.igUsername
          ? `@${meta.igUsername}`
          : null
        : meta.pageName,
    tokenExpiresAt: meta.tokenExpiresAt,
    connectedAt: meta.connectedAt,
    needsReconnect: meta.needsReconnect,
    metadata: {
      igUsername: meta.igUsername,
      pageName: meta.pageName,
    },
    oauthConfigured: true,
  };
}

function disconnectedSocial(
  platform: PublishPlatform,
  oauthConfigured: boolean
): SocialConnectionPublic {
  return {
    platform,
    connected: false,
    status: "disconnected",
    displayName: null,
    tokenExpiresAt: null,
    connectedAt: null,
    needsReconnect: false,
    metadata: {},
    oauthConfigured,
  };
}

export async function listSocialConnectionsPublic(
  clientId: string,
  oauthFlags?: { linkedin?: boolean; pinterest?: boolean }
): Promise<SocialConnectionPublic[]> {
  const meta = await getMetaConnectionPublic(clientId);
  const linkedinConfigured = oauthFlags?.linkedin ?? false;
  const pinterestConfigured = oauthFlags?.pinterest ?? false;

  const result: SocialConnectionPublic[] = [
    metaAsSocial("instagram", meta),
    metaAsSocial("facebook", meta),
  ];

  if (!isDatabaseConfigured()) {
    result.push(
      disconnectedSocial("linkedin", linkedinConfigured),
      disconnectedSocial("pinterest", pinterestConfigured)
    );
    return result;
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(clientSocialConnections)
    .where(eq(clientSocialConnections.clientId, clientId));

  for (const platform of ["linkedin", "pinterest"] as const) {
    const row = rows.find((r) => r.platform === platform);
    const oauthConfigured = platform === "linkedin" ? linkedinConfigured : pinterestConfigured;
    if (!row || row.status === "revoked") {
      result.push(disconnectedSocial(platform, oauthConfigured));
    } else {
      result.push(mapSocialRow(platform, row, oauthConfigured));
    }
  }

  return result;
}

export async function getSocialConnectionWithToken(
  clientId: string,
  platform: PublishPlatform
): Promise<SocialConnectionWithToken | null> {
  if (isMetaPlatform(platform)) return null;
  if (!isDatabaseConfigured()) return null;

  const db = getDb();
  const [row] = await db
    .select()
    .from(clientSocialConnections)
    .where(
      and(
        eq(clientSocialConnections.clientId, clientId),
        eq(clientSocialConnections.platform, platform)
      )
    )
    .limit(1);

  if (!row || row.status === "revoked") return null;
  const pub = mapSocialRow(platform, row, true);
  if (pub.needsReconnect) return null;

  return {
    ...pub,
    accessToken: decryptMetaToken(row.accessTokenEnc),
    refreshToken: row.refreshTokenEnc ? decryptMetaToken(row.refreshTokenEnc) : null,
  };
}

export async function upsertSocialConnection(input: {
  clientId: string;
  userId: string;
  platform: PublishPlatform;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt: Date | null;
  metadata?: Record<string, unknown>;
}): Promise<SocialConnectionPublic> {
  const db = getDb();
  const [row] = await db
    .insert(clientSocialConnections)
    .values({
      clientId: input.clientId,
      platform: input.platform,
      connectedByUserId: input.userId,
      accessTokenEnc: encryptMetaToken(input.accessToken),
      refreshTokenEnc: input.refreshToken ? encryptMetaToken(input.refreshToken) : null,
      tokenExpiresAt: input.tokenExpiresAt,
      metadata: input.metadata ?? {},
      status: "active",
    })
    .onConflictDoUpdate({
      target: [clientSocialConnections.clientId, clientSocialConnections.platform],
      set: {
        connectedByUserId: input.userId,
        accessTokenEnc: encryptMetaToken(input.accessToken),
        refreshTokenEnc: input.refreshToken ? encryptMetaToken(input.refreshToken) : null,
        tokenExpiresAt: input.tokenExpiresAt,
        metadata: input.metadata ?? {},
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning();
  return mapSocialRow(input.platform, row!, true);
}

export async function revokeSocialConnection(
  clientId: string,
  platform: PublishPlatform
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db
    .update(clientSocialConnections)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(
      and(
        eq(clientSocialConnections.clientId, clientId),
        eq(clientSocialConnections.platform, platform)
      )
    );
}

export async function markSocialConnectionExpired(
  clientId: string,
  platform: PublishPlatform
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db
    .update(clientSocialConnections)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(clientSocialConnections.clientId, clientId),
        eq(clientSocialConnections.platform, platform)
      )
    );
}

export function isPlatformConnected(
  connections: SocialConnectionPublic[],
  platform: PublishPlatform
): boolean {
  const c = connections.find((x) => x.platform === platform);
  return Boolean(c?.connected && c.status === "active" && !c.needsReconnect);
}

export async function updateSocialConnectionTokens(
  clientId: string,
  platform: PublishPlatform,
  accessToken: string,
  refreshToken: string | null,
  tokenExpiresAt: Date | null
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db
    .update(clientSocialConnections)
    .set({
      accessTokenEnc: encryptMetaToken(accessToken),
      refreshTokenEnc: refreshToken ? encryptMetaToken(refreshToken) : null,
      tokenExpiresAt,
      status: "active",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clientSocialConnections.clientId, clientId),
        eq(clientSocialConnections.platform, platform)
      )
    );
}
