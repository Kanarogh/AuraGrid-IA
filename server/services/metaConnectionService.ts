import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "../db/client";
import { clientMetaConnections } from "../db/schema";
import { decryptMetaToken, encryptMetaToken } from "./metaTokenCrypto";

export type MetaConnectionPublic = {
  connected: boolean;
  igUserId: string | null;
  igUsername: string | null;
  pageName: string | null;
  status: "active" | "expired" | "revoked" | "disconnected";
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  needsReconnect: boolean;
};

export type MetaConnectionWithToken = MetaConnectionPublic & {
  accessToken: string;
  facebookPageId: string;
};

function mapPublic(row: typeof clientMetaConnections.$inferSelect): MetaConnectionPublic {
  const expired =
    row.tokenExpiresAt != null && row.tokenExpiresAt.getTime() <= Date.now();
  const status =
    row.status === "revoked"
      ? "revoked"
      : expired || row.status === "expired"
        ? "expired"
        : "active";
  return {
    connected: true,
    igUserId: row.igUserId,
    igUsername: row.igUsername,
    pageName: row.pageName,
    status,
    tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
    connectedAt: row.connectedAt.toISOString(),
    needsReconnect: status !== "active",
  };
}

export async function getMetaConnectionPublic(clientId: string): Promise<MetaConnectionPublic> {
  if (!isDatabaseConfigured()) {
    return {
      connected: false,
      igUserId: null,
      igUsername: null,
      pageName: null,
      status: "disconnected",
      tokenExpiresAt: null,
      connectedAt: null,
      needsReconnect: false,
    };
  }
  const db = getDb();
  const [row] = await db
    .select()
    .from(clientMetaConnections)
    .where(eq(clientMetaConnections.clientId, clientId))
    .limit(1);
  if (!row || row.status === "revoked") {
    return {
      connected: false,
      igUserId: null,
      igUsername: null,
      pageName: null,
      status: "disconnected",
      tokenExpiresAt: null,
      connectedAt: null,
      needsReconnect: false,
    };
  }
  return mapPublic(row);
}

export async function getMetaConnectionWithToken(
  clientId: string
): Promise<MetaConnectionWithToken | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(clientMetaConnections)
    .where(eq(clientMetaConnections.clientId, clientId))
    .limit(1);
  if (!row || row.status === "revoked") return null;
  const pub = mapPublic(row);
  if (pub.needsReconnect) return null;
  return {
    ...pub,
    accessToken: decryptMetaToken(row.accessTokenEnc),
    facebookPageId: row.facebookPageId,
  };
}

export async function upsertMetaConnection(input: {
  clientId: string;
  userId: string;
  igUserId: string;
  igUsername: string | null;
  facebookPageId: string;
  pageName: string | null;
  accessToken: string;
  tokenExpiresAt: Date | null;
  scopes: string;
}): Promise<MetaConnectionPublic> {
  const db = getDb();
  const [row] = await db
    .insert(clientMetaConnections)
    .values({
      clientId: input.clientId,
      connectedByUserId: input.userId,
      igUserId: input.igUserId,
      igUsername: input.igUsername,
      facebookPageId: input.facebookPageId,
      pageName: input.pageName,
      accessTokenEnc: encryptMetaToken(input.accessToken),
      tokenExpiresAt: input.tokenExpiresAt,
      scopes: input.scopes,
      status: "active",
    })
    .onConflictDoUpdate({
      target: clientMetaConnections.clientId,
      set: {
        connectedByUserId: input.userId,
        igUserId: input.igUserId,
        igUsername: input.igUsername,
        facebookPageId: input.facebookPageId,
        pageName: input.pageName,
        accessTokenEnc: encryptMetaToken(input.accessToken),
        tokenExpiresAt: input.tokenExpiresAt,
        scopes: input.scopes,
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning();
  return mapPublic(row!);
}

export async function revokeMetaConnection(clientId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db
    .update(clientMetaConnections)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(clientMetaConnections.clientId, clientId));
}

export async function markMetaConnectionExpired(clientId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  await db
    .update(clientMetaConnections)
    .set({ status: "expired", updatedAt: new Date() })
    .where(eq(clientMetaConnections.clientId, clientId));
}
