import { NextResponse, type NextRequest } from "next/server";
import { formatAiError } from "@/server/ai/index";
import { runVisionWithFallback } from "@/server/ai/fallbackChain";
import {
  applyShortlistToResult,
  prepareMatchInput,
  shortlistHeaderValue,
} from "@/server/ai/matchPipeline";
import { sanitizeMatchOperationInput } from "@/server/ai/operations";
import { applyAiHeadersFromNextRequest, aiAttemptsHeaderValue } from "@/server/http/aiRequest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let providerId = await applyAiHeadersFromNextRequest(req);
  try {
    const body = await req.json();
    const { postImage } = body;

    if (!postImage) {
      return NextResponse.json({ error: "No query image provided." }, { status: 400 });
    }

    const sanitized = sanitizeMatchOperationInput("match-reference", {
      postImage,
      catalogProfiles: body.catalogProfiles,
      catalogItems: body.catalogItems,
      matchOnly: true,
    });

    const prepared = await prepareMatchInput(sanitized, providerId);

    const outcome = await runVisionWithFallback(
      "match-reference",
      (provider) => provider.matchAndGenerate(prepared.input),
      providerId
    );

    providerId = outcome.providerUsed;
    const result = applyShortlistToResult(outcome.result, prepared.shortlist);
    const headers = new Headers();
    headers.set("X-AI-Provider-Used", outcome.providerUsed);
    headers.set("X-AI-Match-Mode", result.matchMode);
    headers.set("X-AI-Attempts", aiAttemptsHeaderValue(outcome.attempts));
    const shortlistHeader = shortlistHeaderValue(prepared.shortlist);
    if (shortlistHeader) headers.set("X-AI-Catalog-Shortlist", shortlistHeader);

    return NextResponse.json(
      {
        matchedId: result.matchedId,
        reasoning: result.reasoning,
        matchMode: result.matchMode,
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
