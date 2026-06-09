import { NextResponse, type NextRequest } from "next/server";
import { buildAiSettingsResponse, setOpenRouterModelOverride } from "@/server/ai/index";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  try {
    const { model } = (await req.json()) as { model?: string | null };
    if (model !== null && (typeof model !== "string" || !model.trim())) {
      return NextResponse.json({ error: "model deve ser string ou null." }, { status: 400 });
    }
    if (model && !model.includes("/")) {
      return NextResponse.json({ error: "ID de modelo OpenRouter inválido." }, { status: 400 });
    }
    await setOpenRouterModelOverride(model);
    return NextResponse.json(await buildAiSettingsResponse());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Falha ao trocar modelo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
