import { NextResponse, type NextRequest } from "next/server";
import { buildAiSettingsResponse, setOllamaModelOverride } from "@/server/ai/index";
import { listLocalOllamaModels, sanitizeOllamaModelId } from "@/server/ai/ollamaModels";
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
    const body = (await req.json()) as { model?: string | null };

    if (!("model" in body)) {
      return NextResponse.json({ error: "Informe model." }, { status: 400 });
    }

    const model = body.model;
    if (model !== null && (typeof model !== "string" || !model.trim())) {
      return NextResponse.json({ error: "model deve ser string ou null." }, { status: 400 });
    }

    const data = await runWithAiUser(req, async () => {
      if (model) {
        const sanitized = sanitizeOllamaModelId(model);
        if (!sanitized) {
          throw new Error("ID de modelo Ollama inválido.");
        }
        const { models, reachable } = await listLocalOllamaModels();
        if (!reachable) {
          throw new Error("Ollama não está acessível. Abra o app Ollama e tente de novo.");
        }
        const installed = models.some((m) => m.id === sanitized);
        if (!installed) {
          throw new Error(
            `Modelo "${sanitized}" não está instalado localmente. Use: ollama pull ${sanitized.replace(/:.*$/, "")}`
          );
        }
        await setOllamaModelOverride(sanitized);
      } else {
        await setOllamaModelOverride(null);
      }
      return buildAiSettingsResponse();
    });
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
