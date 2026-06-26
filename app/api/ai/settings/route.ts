import { NextResponse, type NextRequest } from "next/server";
import { buildAiSettingsResponse } from "@/server/ai/index";
import { withUserAiContext } from "@/server/ai/userAiContext";
import { isDatabaseConfigured } from "@/server/db/client";
import { getOptionalUserFromRequest, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";

export const dynamic = "force-dynamic";

async function runWithAiUser<T>(
  req: NextRequest,
  handler: () => Promise<T>
): Promise<T> {
  if (isDatabaseConfigured()) {
    const user = requireUser(req);
    return withUserAiContext(user.id, handler);
  }
  const user = await getOptionalUserFromRequest(req);
  if (user) return withUserAiContext(user.id, handler);
  return handler();
}

export async function GET(req: NextRequest) {
  try {
    const data = await runWithAiUser(req, () => buildAiSettingsResponse());
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err, 401);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { provider?: string };
    if (body.provider && body.provider !== "gemini") {
      return NextResponse.json(
        { error: "Projeto configurado como Gemini-only. Use apenas Gemini." },
        { status: 400 }
      );
    }
    const data = await runWithAiUser(req, () => buildAiSettingsResponse());
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
