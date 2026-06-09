import { NextResponse, type NextRequest } from "next/server";
import { formatAiError } from "@/server/ai/index";
import { runVisionWithFallback } from "@/server/ai/fallbackChain";
import {
  assertBrandGemReadyForCaptions,
  resolveBrandGemFromBody,
} from "@/server/ai/brandContext";
import { applyAiHeadersFromNextRequest, aiAttemptsHeaderValue } from "@/server/http/aiRequest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let providerId = await applyAiHeadersFromNextRequest(req);
  try {
    const {
      postImage,
      catalogItems,
      catalogProfiles,
      brandGem,
      promptContext,
      repeatingText,
      regenerateCaption,
      captionFromImageOnly,
    } = await req.json();

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

    const imageOnly = !!captionFromImageOnly;
    const profiles = Array.isArray(catalogProfiles) ? catalogProfiles : [];
    const items = Array.isArray(catalogItems) ? catalogItems : [];

    if (!imageOnly) {
      if (items.length > 0 && profiles.length === 0) {
        return NextResponse.json(
          {
            error:
              "Catálogo não indexado. Indexe todas as referências (JSON) antes de gerar legendas — a comparação usa os perfis indexados, não as fotos do acervo.",
          },
          { status: 400 }
        );
      }
      if (profiles.length > 0 && !profiles.every((p) => p?.id && p?.label && p?.profile)) {
        return NextResponse.json(
          {
            error:
              "catalogProfiles incompleto. Indexe todas as referências antes de gerar legendas.",
          },
          { status: 400 }
        );
      }
    }

    const outcome = await runVisionWithFallback(
      "match-and-generate",
      (provider) =>
        provider.matchAndGenerate({
          postImage,
          catalogItems: imageOnly ? undefined : catalogItems,
          catalogProfiles: imageOnly ? undefined : catalogProfiles,
          brandGem,
          promptContext,
          repeatingText,
          regenerateCaption: !!regenerateCaption,
          captionFromImageOnly: imageOnly,
        }),
      providerId
    );

    providerId = outcome.providerUsed;
    const headers = new Headers();
    headers.set("X-AI-Provider-Used", outcome.providerUsed);
    headers.set("X-AI-Match-Mode", outcome.result.matchMode);
    headers.set("X-AI-Attempts", aiAttemptsHeaderValue(outcome.attempts));

    return NextResponse.json(
      { ...outcome.result, providerUsed: outcome.providerUsed },
      { headers }
    );
  } catch (error: unknown) {
    console.error("Error matching post & generating caption:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return NextResponse.json({ error: formatAiError(error, providerId) }, { status });
  }
}
