import { NextResponse, type NextRequest } from "next/server";
import { formatAiError } from "@/server/ai/index";
import { runVisionWithFallback } from "@/server/ai/fallbackChain";
import { applyAiHeadersFromNextRequest, aiAttemptsHeaderValue } from "@/server/http/aiRequest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let providerId = await applyAiHeadersFromNextRequest(req);
  try {
    const { postImage, catalogItems, catalogProfiles } = await req.json();

    if (!postImage) {
      return NextResponse.json({ error: "No query image provided." }, { status: 400 });
    }

    const outcome = await runVisionWithFallback(
      "match-reference",
      (provider) =>
        provider.matchAndGenerate({
          postImage,
          catalogItems,
          catalogProfiles,
          matchOnly: true,
        }),
      providerId
    );

    providerId = outcome.providerUsed;
    const headers = new Headers();
    headers.set("X-AI-Provider-Used", outcome.providerUsed);
    headers.set("X-AI-Match-Mode", outcome.result.matchMode);
    headers.set("X-AI-Attempts", aiAttemptsHeaderValue(outcome.attempts));

    return NextResponse.json(
      {
        matchedId: outcome.result.matchedId,
        reasoning: outcome.result.reasoning,
        matchMode: outcome.result.matchMode,
        providerUsed: outcome.providerUsed,
      },
      { headers }
    );
  } catch (error: unknown) {
    console.error("Error matching catalog reference:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return NextResponse.json({ error: formatAiError(error, providerId) }, { status });
  }
}
