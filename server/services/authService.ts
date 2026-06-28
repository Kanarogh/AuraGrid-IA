import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, eq, isNull } from "drizzle-orm";
import { JWT_ACCESS_TTL, JWT_REFRESH_TTL_DAYS, JWT_SECRET } from "../config/env";
import { getDb } from "../db/client";
import { refreshTokens, userAiPreferences, users } from "../db/schema";
import { buildAuthUserProfile } from "./permissionService";
import type { AuthUserProfile } from "@/src/lib/permissions/types";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type LoginResult = {
  user: AuthUserProfile;
  tokens: AuthTokens;
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
  const displayName = input.displayName.trim() || email.split("@")[0] || "UsuÃ¡rio";
  const db = getDb();

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new Error("E-mail jÃ¡ cadastrado.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const [row] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      displayName,
      accountRole: "owner",
      mustChangePassword: false,
      status: "active",
    })
    .returning();

  const user: AuthUser = { id: row!.id, email: row!.email, displayName: row!.displayName };
  const tokens = await issueTokens(user);
  return { user, tokens };
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!row) throw new Error("E-mail ou senha inválidos.");

  if (row.status === "suspended") {
    throw new Error("Conta suspensa. Contacte o administrador.");
  }

  const ok = await bcrypt.compare(input.password, row.passwordHash);
  if (!ok) throw new Error("E-mail ou senha inválidos.");

  const profile = await buildAuthUserProfile(row.id);
  if (!profile) throw new Error("Usuário não encontrado.");

  const tokens = await issueTokens({
    id: row.id,
    email: row.email,
    displayName: row.displayName,
  });
  return { user: profile, tokens };
}

export async function changeUserPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<AuthUserProfile> {
  if (input.newPassword.length < 8) {
    throw new Error("A nova senha deve ter pelo menos 8 caracteres.");
  }
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!row) throw new Error("Usuário não encontrado.");

  const ok = await bcrypt.compare(input.currentPassword, row.passwordHash);
  if (!ok) throw new Error("Senha atual incorreta.");

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId));

  const profile = await buildAuthUserProfile(input.userId);
  if (!profile) throw new Error("Usuário não encontrado.");
  return profile;
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
    throw new Error("Token invÃ¡lido.");
  }
  return {
    id: payload.sub,
    email: String(payload.email ?? ""),
    displayName: String(payload.name ?? ""),
  };
}

export async function refreshSession(refreshToken: string): Promise<{
  user: AuthUserProfile;
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
    throw new Error("SessÃ£o expirada. FaÃ§a login novamente.");
  }

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, row.id));

  const [userRow] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!userRow) throw new Error("Usuário não encontrado.");
  if (userRow.status === "suspended") {
    throw new Error("Conta suspensa. Contacte o administrador.");
  }

  const user: AuthUser = {
    id: userRow.id,
    email: userRow.email,
    displayName: userRow.displayName,
  };

  const profile = await buildAuthUserProfile(userRow.id);
  if (!profile) throw new Error("Usuário não encontrado.");

  const tokens = await issueTokens(user);
  return {
    user: profile,
    tokens,
  };
}

/** Valida refresh token sem rotacionar â€” seguro para `<img>` e outras requisiÃ§Ãµes GET frequentes. */
export async function getUserFromRefreshToken(refreshToken: string): Promise<AuthUser | null> {
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

  if (!row || row.expiresAt.getTime() < Date.now()) return null;

  const [userRow] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!userRow) return null;

  return {
    id: userRow.id,
    email: userRow.email,
    displayName: userRow.displayName,
  };
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
  patch: { geminiModel?: string | null; geminiCatalogModel?: string | null }
) {
  const db = getDb();
  const existing = await getUserAiPreferences(userId);
  if (!existing) {
    await db.insert(userAiPreferences).values({
      userId,
      geminiModel: patch.geminiModel ?? null,
      geminiCatalogModel: patch.geminiCatalogModel ?? null,
    });
    return;
  }
  await db
    .update(userAiPreferences)
    .set({
      geminiModel:
        patch.geminiModel !== undefined ? patch.geminiModel : existing.geminiModel,
      geminiCatalogModel:
        patch.geminiCatalogModel !== undefined
          ? patch.geminiCatalogModel
          : existing.geminiCatalogModel,
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

