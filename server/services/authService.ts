import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";
import { JWT_ACCESS_TTL, JWT_REFRESH_TTL_DAYS, JWT_SECRET } from "../config/env";
import { getDb } from "../db/client";
import { refreshTokens, userAiPreferences, users } from "../db/schema";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseAccessTtlMs(): number {
  const raw = JWT_ACCESS_TTL;
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return 15 * 60 * 1000;
  const n = parseInt(match[1]!, 10);
  const unit = match[2];
  if (unit === "s") return n * 1000;
  if (unit === "m") return n * 60 * 1000;
  if (unit === "h") return n * 60 * 60 * 1000;
  return n * 24 * 60 * 60 * 1000;
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || email.split("@")[0] || "Usuário";
  const db = getDb();

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new Error("E-mail já cadastrado.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const [row] = await db
    .insert(users)
    .values({ email, passwordHash, displayName })
    .returning();

  const user: AuthUser = { id: row!.id, email: row!.email, displayName: row!.displayName };
  const tokens = await issueTokens(user);
  return { user, tokens };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser; tokens: AuthTokens }> {
  const email = input.email.trim().toLowerCase();
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!row) throw new Error("E-mail ou senha inválidos.");

  const ok = await bcrypt.compare(input.password, row.passwordHash);
  if (!ok) throw new Error("E-mail ou senha inválidos.");

  const user: AuthUser = { id: row.id, email: row.email, displayName: row.displayName };
  const tokens = await issueTokens(user);
  return { user, tokens };
}

async function issueTokens(user: AuthUser): Promise<AuthTokens> {
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, name: user.displayName },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"] }
  );

  const refreshToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
  });

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Token inválido.");
  }
  return {
    id: payload.sub,
    email: String(payload.email ?? ""),
    displayName: String(payload.name ?? ""),
  };
}

export async function refreshSession(refreshToken: string): Promise<{
  user: AuthUser;
  tokens: AuthTokens;
}> {
  const db = getDb();
  const tokenHash = hashToken(refreshToken);
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt)
      )
    )
    .limit(1);

  if (!row || row.expiresAt.getTime() < Date.now()) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, row.id));

  const [userRow] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!userRow) throw new Error("Usuário não encontrado.");

  const user: AuthUser = {
    id: userRow.id,
    email: userRow.email,
    displayName: userRow.displayName,
  };
  const tokens = await issueTokens(user);
  return { user, tokens };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const db = getDb();
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, hashToken(refreshToken)));
}

export async function getUserAiPreferences(userId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userAiPreferences)
    .where(eq(userAiPreferences.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function upsertUserAiPreferences(
  userId: string,
  patch: { activeProvider?: string | null; openrouterModel?: string | null }
) {
  const db = getDb();
  const existing = await getUserAiPreferences(userId);
  if (!existing) {
    await db.insert(userAiPreferences).values({
      userId,
      activeProvider: patch.activeProvider ?? null,
      openrouterModel: patch.openrouterModel ?? null,
    });
    return;
  }
  await db
    .update(userAiPreferences)
    .set({
      activeProvider:
        patch.activeProvider !== undefined ? patch.activeProvider : existing.activeProvider,
      openrouterModel:
        patch.openrouterModel !== undefined
          ? patch.openrouterModel
          : existing.openrouterModel,
      updatedAt: new Date(),
    })
    .where(eq(userAiPreferences.userId, userId));
}

export function accessTokenMaxAgeMs(): number {
  return parseAccessTtlMs();
}

export function refreshCookieMaxAgeMs(): number {
  return JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
}
