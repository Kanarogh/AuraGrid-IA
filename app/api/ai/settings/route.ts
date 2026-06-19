import { NextResponse, type NextRequest } from "next/server";
import { buildAiSettingsResponse, setActiveAiProvider } from "@/server/ai/index";
import { isLocalAiAllowed } from "@/server/config/deploy";
import type { AiProviderId } from "@/server/ai/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refreshParam = req.nextUrl.searchParams.get("refresh");
  const refresh = refreshParam === "1" || refreshParam === "true";
  return NextResponse.json(await buildAiSettingsResponse({ refreshOpenRouter: refresh }));
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
    await setActiveAiProvider(provider as AiProviderId);
    return NextResponse.json(await buildAiSettingsResponse());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Falha ao trocar provedor.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
