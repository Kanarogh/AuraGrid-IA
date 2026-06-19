import { NextResponse, type NextRequest } from "next/server";
import { formatAiError, getActiveProviderId } from "@/server/ai/index";
import { runVisionWithFallback } from "@/server/ai/fallbackChain";
import { aiAttemptsHeaderValue, withUserAiFromRequest } from "@/server/http/aiRequest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withUserAiFromRequest(req, async () => {
    let providerId = getActiveProviderId();
    try {
    const { image, label, id } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "No catalog image provided." }, { status: 400 });
    }

    const outcome = await runVisionWithFallback(
      "enrich-catalog-item",
      (provider) => provider.enrichCatalogItem({ image, label, id }),
      providerId
    );

    providerId = outcome.providerUsed;
    const headers = new Headers();
    headers.set("X-AI-Provider-Used", outcome.providerUsed);
    if (outcome.modelLabel) headers.set("X-AI-Model-Used", outcome.modelLabel);
    headers.set("X-AI-Attempts", aiAttemptsHeaderValue(outcome.attempts));

    return NextResponse.json(
      {
        profile: outcome.result,
        providerUsed: outcome.providerUsed,
        modelUsed: outcome.modelLabel,
      },
      { headers }
    );
  } catch (error: unknown) {
    console.error("Error enriching catalog item:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return NextResponse.json({ error: formatAiError(error, providerId) }, { status });
    }
  });
}
