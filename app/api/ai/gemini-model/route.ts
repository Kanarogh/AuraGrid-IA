import { NextResponse, type NextRequest } from "next/server";
import {
  buildAiSettingsResponse,
  setGeminiCatalogModelOverride,
  setGeminiContentScheduleModelOverride,
  setGeminiIndexingModelOverride,
  setGeminiModelOverride,
  setGeminiPlanningModelOverride,
  setGeminiReferenceModelOverride,
} from "@/server/ai/index";
import { withUserAiContext } from "@/server/ai/userAiContext";
import { sanitizeGeminiModelId } from "@/server/ai/geminiModels";
import { isDatabaseConfigured } from "@/server/db/client";
import { getOptionalUserFromRequest, requireUser } from "@/server/http/auth";
import { assertTeamAdmin } from "@/server/services/permissionService";
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
    if (isDatabaseConfigured()) {
      await assertTeamAdmin(requireUser(req));
    }
    const body = (await req.json()) as {
      model?: string | null;
      catalogModel?: string | null;
      planningModel?: string | null;
      indexingModel?: string | null;
      contentScheduleModel?: string | null;
      referenceModel?: string | null;
    };

    const fieldChecks: Array<[string, string | null | undefined]> = [
      ["model", body.model],
      ["catalogModel", body.catalogModel],
      ["planningModel", body.planningModel],
      ["indexingModel", body.indexingModel],
      ["contentScheduleModel", body.contentScheduleModel],
      ["referenceModel", body.referenceModel],
    ];

    for (const [field, value] of fieldChecks) {
      if (!(field in body)) continue;
      if (value !== null && (typeof value !== "string" || !value.trim())) {
        return NextResponse.json(
          { error: `${field} deve ser string ou null.` },
          { status: 400 }
        );
      }
      if (value && !sanitizeGeminiModelId(value)) {
        return NextResponse.json(
          { error: `ID de modelo inválido para ${field}.` },
          { status: 400 }
        );
      }
    }

    if (
      !("model" in body) &&
      !("catalogModel" in body) &&
      !("planningModel" in body) &&
      !("indexingModel" in body) &&
      !("contentScheduleModel" in body) &&
      !("referenceModel" in body)
    ) {
      return NextResponse.json(
        {
          error:
            "Informe model, catalogModel, planningModel, indexingModel, contentScheduleModel e/ou referenceModel.",
        },
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
      if ("planningModel" in body) {
        await setGeminiPlanningModelOverride(body.planningModel ?? null);
      }
      if ("indexingModel" in body) {
        await setGeminiIndexingModelOverride(body.indexingModel ?? null);
      }
      if ("contentScheduleModel" in body) {
        await setGeminiContentScheduleModelOverride(body.contentScheduleModel ?? null);
      }
      if ("referenceModel" in body) {
        await setGeminiReferenceModelOverride(body.referenceModel ?? null);
      }
      return buildAiSettingsResponse();
    });
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
