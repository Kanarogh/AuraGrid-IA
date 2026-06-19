import { NextResponse, type NextRequest } from "next/server";
import {
  buildAiSettingsResponse,
  setGeminiCatalogModelOverride,
  setGeminiModelOverride,
} from "@/server/ai/index";
import { withUserAiContext } from "@/server/ai/userAiContext";
import { sanitizeGeminiModelId } from "@/server/ai/geminiModels";
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
    }

    if (!("model" in body) && !("catalogModel" in body)) {
      return NextResponse.json(
        { error: "Informe model e/ou catalogModel." },
        { status: 400 }
      );
    }

    const data = await runWithAiUser(req, async () => {
      if ("model" in body) {
        await setGeminiModelOverride(body.model ?? null);
      }
      if ("catalogModel" in body) {
        await setGeminiCatalogModelOverride(body.catalogModel ?? null);
      }
      return buildAiSettingsResponse();
    });
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
