import { NextResponse, type NextRequest } from "next/server";
import { formatAiError, getActiveProvider, getActiveProviderId } from "@/server/ai/index";
import { getGeminiPlanningModel } from "@/server/ai/config";
import {
  assertBrandGemReadyForCaptions,
  resolveBrandGemFromBody,
} from "@/server/ai/brandContext";
import { sanitizeRefinedCaptionOutput } from "@/server/ai/shared";
import { withUserAiFromRequest } from "@/server/http/aiRequest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withUserAiFromRequest(req, async () => {
    const providerId = getActiveProviderId();
    try {
    const { currentCaption, instructions, brandGem, promptContext, repeatingText } =
      await req.json();
    if (!currentCaption) {
      return NextResponse.json({ error: "Missing caption to refine." }, { status: 400 });
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

    const provider = getActiveProvider();
    if (!String(instructions ?? "").trim()) {
      return NextResponse.json(
        { error: "Informe como deseja refinar a legenda." },
        { status: 400 }
      );
    }

    const caption = await provider.refineCaption({
      currentCaption,
      instructions,
      brandGem,
      promptContext,
      repeatingText,
    });
    const modelUsed = getGeminiPlanningModel();
    return NextResponse.json(
      { caption: sanitizeRefinedCaptionOutput(caption), modelUsed },
      {
        headers: {
          "X-AI-Model-Used": modelUsed,
          "X-AI-Provider-Used": providerId,
        },
      }
    );
  } catch (error: unknown) {
    console.error("Error refining caption:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return NextResponse.json({ error: formatAiError(error, providerId) }, { status });
    }
  });
}
