import type { NextRequest } from "next/server";
import { getAiProviderId } from "../ai/config";
import { ensureRuntimeAiSettingsLoaded } from "../ai/runtimeSettings";
import { withUserAiContext } from "../ai/userAiContext";
import { sanitizeAiAttemptsForHeader, type AiAttemptHeader } from "../ai/httpHeaders";
import { sanitizeForHttpHeader } from "../ai/httpHeaders";
import type { AiProviderId } from "../ai/types";
import { isDatabaseConfigured } from "../db/client";
import { getOptionalUserFromRequest } from "./auth";

export async function applyAiHeadersFromNextRequest(_req: NextRequest): Promise<AiProviderId> {
  await ensureRuntimeAiSettingsLoaded();
  return getAiProviderId();
}

export async function withUserAiFromRequest<T>(
  req: NextRequest,
  handler: () => Promise<T>
): Promise<T> {
  await ensureRuntimeAiSettingsLoaded();
  const user = await getOptionalUserFromRequest(req);
  if (user && isDatabaseConfigured()) {
    return withUserAiContext(user.id, async () => {
      await applyAiHeadersFromNextRequest(req);
      return handler();
    });
  }
  await applyAiHeadersFromNextRequest(req);
  return handler();
}

export function aiAttemptsHeaderValue(attempts: AiAttemptHeader[]): string {
  return sanitizeForHttpHeader(JSON.stringify(sanitizeAiAttemptsForHeader(attempts)), 4096);
}
