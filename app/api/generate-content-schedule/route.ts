import { NextResponse, type NextRequest } from "next/server";
import { formatAiError, getActiveProviderId } from "@/server/ai/index";
import { resolveBrandGemFromBody, assertBrandGemReadyForCaptions } from "@/server/ai/brandContext";
import { getGeminiContentScheduleModel } from "@/server/ai/config";
import {
  generateContentSchedule,
  refineContentScheduleItem,
} from "@/server/ai/contentScheduleGenerator";
import { assertAiClientAccess, withUserAiFromRequest } from "@/server/http/aiRequest";
import { CONTENT_SCHEDULE_WRITE } from "@/server/http/sectionAccess";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withUserAiFromRequest(req, async (user) => {
    const providerId = getActiveProviderId();
    const modelUsed = getGeminiContentScheduleModel();
    try {
      const body = await req.json();
      const {
        brandGem,
        promptContext,
        repeatingText,
        clientBrief,
        clientId: rawClientId,
        mode = "monthly",
        options,
        existingItem,
        refineInstruction,
      } = body;

      await assertAiClientAccess(user, rawClientId, CONTENT_SCHEDULE_WRITE);

      if (mode !== "refine_one") {
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
      }

      if (mode === "refine_one") {
        if (!existingItem?.id) {
          return NextResponse.json({ error: "Item não informado para refinamento." }, { status: 400 });
        }
        if (!String(refineInstruction ?? "").trim()) {
          return NextResponse.json(
            { error: "Informe como deseja refinar o item." },
            { status: 400 }
          );
        }
        const item = await refineContentScheduleItem({
          brandGem,
          promptContext,
          repeatingText,
          existingItem,
          refineInstruction,
        });
        return NextResponse.json(
          { items: [item], modelUsed },
          { headers: { "X-AI-Model-Used": modelUsed } }
        );
      }

      const postCount = Math.min(30, Math.max(1, Number(options?.postCount) || 9));
      const storyCount = Math.min(30, Math.max(1, Number(options?.storyCount) || 12));
      const startDate =
        typeof options?.startDate === "string" && options.startDate.trim()
          ? options.startDate.trim()
          : new Date().toISOString().slice(0, 10);

      const items = await generateContentSchedule({
        brandGem: brandGem ?? resolveBrandGemFromBody({ promptContext, repeatingText }),
        clientBrief: typeof clientBrief === "string" ? clientBrief : "",
        options: {
          postCount,
          storyCount,
          startDate,
          extraInstructions:
            typeof options?.extraInstructions === "string"
              ? options.extraInstructions
              : undefined,
        },
      });

      return NextResponse.json(
        { items, modelUsed },
        { headers: { "X-AI-Model-Used": modelUsed } }
      );
    } catch (error: unknown) {
      console.error("Error generating content schedule:", error);
      const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
      return NextResponse.json({ error: formatAiError(error, providerId) }, { status });
    }
  });
}
