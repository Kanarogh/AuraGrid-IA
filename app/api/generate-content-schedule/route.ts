import { NextResponse, type NextRequest } from "next/server";
import { formatAiError, getActiveProviderId } from "@/server/ai/index";
import { resolveBrandGemFromBody, assertBrandGemReadyForCaptions } from "@/server/ai/brandContext";
import { getGeminiContentScheduleModel } from "@/server/ai/config";
import {
  generateContentSchedule,
  generateSingleContentScheduleItem,
  refineContentScheduleItem,
} from "@/server/ai/contentScheduleGenerator";
import { assertAiClientAccess, withUserAiFromRequest } from "@/server/http/aiRequest";
import { errorResponse, HttpError } from "@/server/http/respond";
import { CONTENT_SCHEDULE_WRITE } from "@/server/http/sectionAccess";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    return await withUserAiFromRequest(req, async (user) => {
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

      if (mode === "generate_one") {
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

        const section = body.section === "stories" ? "stories" : "posts";
        const order = Math.min(999, Math.max(1, Number(options?.order) || 1));
        const startDate =
          typeof options?.startDate === "string" && options.startDate.trim()
            ? options.startDate.trim()
            : new Date().toISOString().slice(0, 10);
        const existingItems = Array.isArray(options?.existingItems)
          ? options.existingItems
              .filter(
                (row: unknown) =>
                  row &&
                  typeof row === "object" &&
                  typeof (row as { name?: unknown }).name === "string" &&
                  typeof (row as { headline?: unknown }).headline === "string"
              )
              .slice(0, 30)
          : [];

        const item = await generateSingleContentScheduleItem({
          brandGem: brandGem ?? resolveBrandGemFromBody({ promptContext, repeatingText }),
          clientBrief: typeof clientBrief === "string" ? clientBrief : "",
          section,
          options: {
            startDate,
            order,
            extraInstructions:
              typeof options?.extraInstructions === "string"
                ? options.extraInstructions
                : undefined,
            itemInstruction:
              typeof options?.itemInstruction === "string"
                ? options.itemInstruction
                : undefined,
            existingItems,
          },
        });
        return NextResponse.json(
          { items: [item], modelUsed },
          { headers: { "X-AI-Model-Used": modelUsed } }
        );
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
      if (error instanceof HttpError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
      return NextResponse.json({ error: formatAiError(error, providerId) }, { status });
    }
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
