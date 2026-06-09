import { NextResponse, type NextRequest } from "next/server";
import { buildAiSettingsResponse, setActiveAiProvider } from "@/server/ai/index";
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
    if (
      provider !== "gemini" &&
      provider !== "groq" &&
      provider !== "openrouter" &&
      provider !== "ollama"
    ) {
      return NextResponse.json(
        { error: "Provedor inválido. Use: gemini, groq, openrouter ou ollama." },
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
