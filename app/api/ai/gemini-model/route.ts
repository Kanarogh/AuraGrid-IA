import { NextResponse, type NextRequest } from "next/server";
import {
  buildAiSettingsResponse,
  setGeminiCatalogModelOverride,
  setGeminiModelOverride,
} from "@/server/ai/index";
import { sanitizeGeminiModelId } from "@/server/ai/geminiModels";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      model?: string | null;
      catalogModel?: string | null;
    };

    if ("model" in body) {
      const model = body.model;
      if (model !== null && (typeof model !== "string" || !model.trim())) {
        return NextResponse.json({ error: "model deve ser string ou null." }, { status: 400 });
      }
      if (model && !sanitizeGeminiModelId(model)) {
        return NextResponse.json({ error: "ID de modelo Gemini inválido." }, { status: 400 });
      }
      await setGeminiModelOverride(model);
    }

    if ("catalogModel" in body) {
      const catalogModel = body.catalogModel;
      if (catalogModel !== null && (typeof catalogModel !== "string" || !catalogModel.trim())) {
        return NextResponse.json(
          { error: "catalogModel deve ser string ou null." },
          { status: 400 }
        );
      }
      if (catalogModel && !sanitizeGeminiModelId(catalogModel)) {
        return NextResponse.json({ error: "ID de modelo catálogo inválido." }, { status: 400 });
      }
      await setGeminiCatalogModelOverride(catalogModel);
    }

    if (!("model" in body) && !("catalogModel" in body)) {
      return NextResponse.json(
        { error: "Informe model e/ou catalogModel." },
        { status: 400 }
      );
    }

    return NextResponse.json(await buildAiSettingsResponse());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Falha ao trocar modelo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
