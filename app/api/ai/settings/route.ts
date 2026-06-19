import { NextResponse, type NextRequest } from "next/server";
import { buildAiSettingsResponse, setActiveAiProvider } from "@/server/ai/index";
import { withUserAiContext } from "@/server/ai/userAiContext";
import { isLocalAiAllowed } from "@/server/config/deploy";
import { isDatabaseConfigured } from "@/server/db/client";
import { getOptionalUserFromRequest, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import type { AiProviderId } from "@/server/ai/types";

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
    const refreshParam = req.nextUrl.searchParams.get("refresh");
    const refresh = refreshParam === "1" || refreshParam === "true";
    const data = await runWithAiUser(req, () =>
      buildAiSettingsResponse({ refreshOpenRouter: refresh })
    );
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err, 401);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { provider } = (await req.json()) as { provider?: string };
    if (provider === "ollama" && !isLocalAiAllowed()) {
      return NextResponse.json(
        { error: "Ollama local não está disponível em produção." },
        { status: 400 }
      );
    }
    if (
      provider !== "gemini" &&
      provider !== "groq" &&
      provider !== "openrouter" &&
      provider !== "ollama"
    ) {
      return NextResponse.json(
        { error: "Provedor inválido. Use: gemini, groq ou openrouter." },
        { status: 400 }
      );
    }
    const data = await runWithAiUser(req, async () => {
      await setActiveAiProvider(provider as AiProviderId);
      return buildAiSettingsResponse();
    });
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
