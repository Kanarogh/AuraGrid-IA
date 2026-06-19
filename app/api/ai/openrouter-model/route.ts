import { NextResponse, type NextRequest } from "next/server";
import { buildAiSettingsResponse, setOpenRouterModelOverride } from "@/server/ai/index";
import { withUserAiContext } from "@/server/ai/userAiContext";
import { isDatabaseConfigured } from "@/server/db/client";
import { getOptionalUserFromRequest, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";

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

export async function PUT(req: NextRequest) {
  try {
    const { model } = (await req.json()) as { model?: string | null };
    if (model !== null && (typeof model !== "string" || !model.trim())) {
      return NextResponse.json({ error: "model deve ser string ou null." }, { status: 400 });
    }
    if (model && !model.includes("/")) {
      return NextResponse.json({ error: "ID de modelo OpenRouter inválido." }, { status: 400 });
    }
    const data = await runWithAiUser(req, async () => {
      await setOpenRouterModelOverride(model ?? null);
      return buildAiSettingsResponse();
    });
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
