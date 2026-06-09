import { NextResponse, type NextRequest } from "next/server";
import { hasOpenRouterKey } from "@/server/ai/config";
import type { OpenRouterModelsFilter } from "@/server/ai/index";
import {
  clearOpenRouterModelsCache,
  listLiveOpenRouterModels,
} from "@/server/ai/openrouterModelsLive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!hasOpenRouterKey()) {
    return NextResponse.json({
      models: [],
      filter: "vision-text",
      fetchedAt: null,
      fromCache: false,
      error: "OPENROUTER_API_KEY não configurada no .env",
    });
  }

  const filterRaw = String(req.nextUrl.searchParams.get("filter") ?? "vision-text");
  const filter: OpenRouterModelsFilter =
    filterRaw === "vision-image" || filterRaw === "vision-any" ? filterRaw : "vision-text";
  const refreshParam = req.nextUrl.searchParams.get("refresh");
  const refresh = refreshParam === "1" || refreshParam === "true";
  if (refresh) clearOpenRouterModelsCache();

  try {
    const result = await listLiveOpenRouterModels(process.env.OPENROUTER_API_KEY!.trim(), {
      refresh,
      filter,
    });
    return NextResponse.json({
      filter,
      filterUrls: {
        visionText:
          "https://openrouter.ai/models?output_modalities=text&input_modalities=image",
        visionImage:
          "https://openrouter.ai/models?output_modalities=image&input_modalities=image",
      },
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message, models: [] }, { status: 502 });
  }
}
