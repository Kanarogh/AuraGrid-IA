import { NextResponse, type NextRequest } from "next/server";
import { getAiDiagnosticsSnapshot } from "@/server/ai/diagnostics";
import { withUserAiContext } from "@/server/ai/userAiContext";
import { isDatabaseConfigured } from "@/server/db/client";
import { getOptionalUserFromRequest, requireUser } from "@/server/http/auth";

export const dynamic = "force-dynamic";

async function runWithAiUser<T>(req: NextRequest, handler: () => Promise<T>): Promise<T> {
  if (isDatabaseConfigured()) {
    const user = requireUser(req);
    return withUserAiContext(user.id, handler);
  }
  const user = await getOptionalUserFromRequest(req);
  if (user) return withUserAiContext(user.id, handler);
  return handler();
}

export async function GET(req: NextRequest) {
  return runWithAiUser(req, async () => NextResponse.json(getAiDiagnosticsSnapshot()));
}
