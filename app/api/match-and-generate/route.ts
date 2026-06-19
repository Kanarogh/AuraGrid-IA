import { NextResponse, type NextRequest } from "next/server";
import { formatAiError, getActiveProviderId } from "@/server/ai/index";
import {
  assertBrandGemReadyForCaptions,
  resolveBrandGemFromBody,
} from "@/server/ai/brandContext";
import { matchOperationHeaders, runMatchOperation } from "@/server/ai/matchOrchestrator";
import { sanitizeMatchOperationInput } from "@/server/ai/operations";
import { aiAttemptsHeaderValue, withUserAiFromRequest } from "@/server/http/aiRequest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withUserAiFromRequest(req, async () => {
    let providerId = getActiveProviderId();
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
      diverseBatch,
      clientId,
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
      clientId: typeof clientId === "string" ? clientId : undefined,
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
      diverseBatch: !!diverseBatch,
    });

    const operation = await runMatchOperation("match-and-generate", sanitized, providerId);
    providerId = operation.providerUsed;

    const headers = new Headers(matchOperationHeaders(operation));
    headers.set("X-AI-Provider-Used", operation.providerUsed);
    headers.set("X-AI-Attempts", aiAttemptsHeaderValue(operation.attempts));

    return NextResponse.json(
      { ...operation.result, providerUsed: operation.providerUsed },
      { headers }
    );
  } catch (error: unknown) {
    console.error("Error matching post & generating caption:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return NextResponse.json({ error: formatAiError(error, providerId) }, { status });
    }
  });
}
