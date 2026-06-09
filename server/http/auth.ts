import type { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { clients } from "../db/schema";
import { verifyAccessToken, type AuthUser } from "../services/authService";
import { HttpError } from "./respond";

/** Lê o usuário do header Authorization: Bearer, sem lançar erro. */
export function getOptionalUser(req: NextRequest): AuthUser | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      return verifyAccessToken(header.slice(7));
    } catch {
      return null;
    }
  }
  return null;
}

/** Exige autenticação; lança HttpError 401 se ausente/inválida. */
export function requireUser(req: NextRequest): AuthUser {
  const user = getOptionalUser(req);
  if (!user) throw new HttpError(401, "Autenticação necessária.");
  return user;
}

/** Garante que o cliente pertence ao usuário; lança HttpError 404 caso contrário. */
export async function assertClientAccess(user: AuthUser, clientId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.ownerUserId, user.id),
        isNull(clients.deletedAt)
      )
    )
    .limit(1);
  if (!row) throw new HttpError(404, "Cliente não encontrado.");
}
