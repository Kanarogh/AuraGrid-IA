import { NextResponse, type NextRequest } from "next/server";
import { formatAiError } from "@/server/ai/index";
import { runVisionWithFallback } from "@/server/ai/fallbackChain";
import {
  assertBrandGemReadyForCaptions,
  resolveBrandGemFromBody,
} from "@/server/ai/brandContext";
import {
  applyShortlistToResult,
  applyStrictRankerMatchFallback,
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
    const {
      postImage,
      brandGem,
      promptContext,
      repeatingText,
      regenerateCaption,
      captionFromImageOnly,
      recentHooks,
    } = body;

    if (!postImage) {
      return NextResponse.json({ error: "No post image provided." }, { status: 400 });
    }

    try {
      assertBrandGemReadyForCaptions(
        brandGem ?? resolveBrandGemFromBody({ promptContext, repeatingText })
      );
    } catch (validationError: unknown) {
      return NextResponse.json(
        {
          error:
            validationError instanceof Error
              ? validationError.message
              : String(validationError),
        },
        { status: 400 }
      );
    }

    const sanitized = sanitizeMatchOperationInput("match-and-generate", {
      postImage,
      catalogProfiles: body.catalogProfiles,
      catalogItems: body.catalogItems,
      brandGem,
      promptContext,
      repeatingText,
      regenerateCaption: !!regenerateCaption,
      captionFromImageOnly: !!captionFromImageOnly,
      recentHooks: Array.isArray(recentHooks)
        ? recentHooks.filter((h): h is string => typeof h === "string")
        : undefined,
    });

    const prepared = await prepareMatchInput(sanitized, providerId);

    const outcome = await runVisionWithFallback(
      "match-and-generate",
      (provider) => provider.matchAndGenerate(prepared.input),
      providerId
    );

    providerId = outcome.providerUsed;
    let result = applyShortlistToResult(outcome.result, prepared.shortlist);
    const candidates = prepared.input.catalogProfiles ?? [];
    result = applyStrictRankerMatchFallback(result, prepared.matchRankHint, candidates);
    const headers = new Headers();
    headers.set("X-AI-Provider-Used", outcome.providerUsed);
    headers.set("X-AI-Match-Mode", result.matchMode);
    headers.set("X-AI-Attempts", aiAttemptsHeaderValue(outcome.attempts));
    const shortlistHeader = shortlistHeaderValue(prepared.shortlist);
    if (shortlistHeader) headers.set("X-AI-Catalog-Shortlist", shortlistHeader);

    return NextResponse.json(
      { ...result, providerUsed: outcome.providerUsed },
      { headers }
    );
  } catch (error: unknown) {
    console.error("Error matching post & generating caption:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return NextResponse.json({ error: formatAiError(error, providerId) }, { status });
  }
}
