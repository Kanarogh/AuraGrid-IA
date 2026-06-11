import { NextResponse, type NextRequest } from "next/server";
import { buildAiSettingsResponse, setOllamaModelOverride } from "@/server/ai/index";
import { listLocalOllamaModels, sanitizeOllamaModelId } from "@/server/ai/ollamaModels";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { model?: string | null };

    if (!("model" in body)) {
      return NextResponse.json({ error: "Informe model." }, { status: 400 });
    }

    const model = body.model;
    if (model !== null && (typeof model !== "string" || !model.trim())) {
      return NextResponse.json({ error: "model deve ser string ou null." }, { status: 400 });
    }

    if (model) {
      const sanitized = sanitizeOllamaModelId(model);
      if (!sanitized) {
        return NextResponse.json({ error: "ID de modelo Ollama inválido." }, { status: 400 });
      }
      const { models, reachable } = await listLocalOllamaModels();
      if (!reachable) {
        return NextResponse.json(
          { error: "Ollama não está acessível. Abra o app Ollama e tente de novo." },
          { status: 400 }
        );
      }
      const installed = models.some((m) => m.id === sanitized);
      if (!installed) {
        return NextResponse.json(
          {
            error: `Modelo "${sanitized}" não está instalado localmente. Use: ollama pull ${sanitized.replace(/:.*$/, "")}`,
          },
          { status: 400 }
        );
      }
      await setOllamaModelOverride(sanitized);
    } else {
      await setOllamaModelOverride(null);
    }

    return NextResponse.json(await buildAiSettingsResponse());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Falha ao trocar modelo Ollama.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
