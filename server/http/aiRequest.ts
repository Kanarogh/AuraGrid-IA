import type { NextRequest } from "next/server";
import { getAiProviderId } from "../ai/config";
import { ensureRuntimeAiSettingsLoaded } from "../ai/runtimeSettings";
import { withUserAiContext } from "../ai/userAiContext";
import { sanitizeAiAttemptsForHeader, type AiAttemptHeader } from "../ai/httpHeaders";
import { sanitizeForHttpHeader } from "../ai/httpHeaders";
import type { AiProviderId } from "../ai/types";
import { isDatabaseConfigured } from "../db/client";
import { assertClientAccess, getOptionalUserFromRequest, requireUser } from "./auth";
import type { AuthUser } from "../services/authService";
import { HttpError } from "./respond";

export async function applyAiHeadersFromNextRequest(_req: NextRequest): Promise<AiProviderId> {
  await ensureRuntimeAiSettingsLoaded();
  return getAiProviderId();
}

/** Exige clientId válido e ownership quando DATABASE_URL está configurado. */
export async function assertAiClientAccess(
  user: AuthUser | null,
  clientId: unknown
): Promise<string | undefined> {
  if (typeof clientId !== "string" || !clientId.trim()) return undefined;
  const id = clientId.trim();
  if (isDatabaseConfigured()) {
    if (!user) throw new HttpError(401, "Autenticação necessária.");
    await assertClientAccess(user, id);
  }
  return id;
}

export async function withUserAiFromRequest<T>(
  req: NextRequest,
  handler: (user: AuthUser | null) => Promise<T>
): Promise<T> {
  await ensureRuntimeAiSettingsLoaded();
  let user: AuthUser | null = null;

  if (isDatabaseConfigured()) {
    user = requireUser(req);
    return withUserAiContext(user.id, async () => {
      await applyAiHeadersFromNextRequest(req);
      return handler(user);
    });
  }

  user = await getOptionalUserFromRequest(req);
  if (user) {
    return withUserAiContext(user.id, async () => {
      await applyAiHeadersFromNextRequest(req);
      return handler(user);
    });
  }

  await applyAiHeadersFromNextRequest(req);
  return handler(null);
}

export function aiAttemptsHeaderValue(attempts: AiAttemptHeader[]): string {
  return sanitizeForHttpHeader(JSON.stringify(sanitizeAiAttemptsForHeader(attempts)), 4096);
}
