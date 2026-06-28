import type { NextRequest } from "next/server";
import type { AuthUser } from "../services/authService";
import {
  assertClientAccessResolved,
  type AssertClientAccessOptions,
} from "../services/permissionService";
import {
  getUserFromRefreshToken,
  verifyAccessToken,
} from "../services/authService";
import { REFRESH_COOKIE } from "./cookies";
import { HttpError } from "./respond";

export type { AssertClientAccessOptions };

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

/** Bearer, `?token=` ou cookie de refresh — para rotas acessadas por `<img>` no mesmo domínio. */
export async function getOptionalUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  const fromHeader = getOptionalUser(req);
  if (fromHeader) return fromHeader;

  const token = req.nextUrl.searchParams.get("token");
  if (token) {
    try {
      return verifyAccessToken(token);
    } catch {
      /* continua para cookie */
    }
  }

  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    return getUserFromRefreshToken(refreshToken);
  }

  return null;
}

/** Exige autenticação; lança HttpError 401 se ausente/inválida. */
export function requireUser(req: NextRequest): AuthUser {
  const user = getOptionalUser(req);
  if (!user) throw new HttpError(401, "Autenticação necessária.");
  return user;
}

/** Garante acesso ao cliente (owner ou membro); lança HttpError 404 caso contrário. */
export async function assertClientAccess(
  user: AuthUser,
  clientId: string,
  opts?: AssertClientAccessOptions
): Promise<void> {
  await assertClientAccessResolved(user, clientId, opts);
}
