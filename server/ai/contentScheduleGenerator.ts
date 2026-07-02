import { GoogleGenAI, Type } from "@google/genai";
import {
  assertBrandGemReadyForCaptions,
  resolveBrandGemFromBody,
  type BrandGemConfig,
} from "./brandContext";
import { getGeminiContentScheduleModel } from "./config";
import { callGeminiPlanning } from "./geminiRetry";
import { recordAiUsageEvent } from "../services/aiUsageService";
import {
  buildContentScheduleRefineTask,
  buildContentScheduleRefineResultInstructions,
  buildContentScheduleResultInstructions,
  buildContentScheduleSingleItemTask,
  buildContentScheduleTask,
  type ContentScheduleExistingItemSummary,
  type ContentScheduleGenerateOptions,
} from "./contentSchedulePrompts";
import {
  normalizeRawScheduleItem,
  normalizeRawScheduleItems,
  type RawScheduleItem,
} from "@/src/lib/contentSchedule/normalize";
import type { ContentScheduleItem } from "@/src/types";
import {
  assessScheduleItemsQuality,
  COPY_QUALITY_RETRY_INSTRUCTION,
} from "@/src/lib/contentSchedule/quality";

async function trackGeminiUsage(operation: string, model: string, response: unknown) {
  try {
    await recordAiUsageEvent({
      operation,
      provider: "gemini",
      model,
      usageMetadata: (response as { usageMetadata?: unknown }).usageMetadata,
    });
  } catch (error) {
    console.warn("[ai-usage] falha ao registrar uso Gemini:", error);
  }
}

export type GeneratedContentScheduleItem = ContentScheduleItem;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no .env");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aurastudio-build" } },
  });
}

const ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    section: { type: Type.STRING },
    postType: { type: Type.STRING },
    headline: { type: Type.STRING },
    subtitle: { type: Type.STRING },
    cta: { type: Type.STRING },
    legenda: { type: Type.STRING },
    hashtags: { type: Type.STRING },
    suggestedDate: { type: Type.STRING },
    imagePrompt: { type: Type.STRING },
    storyExtras: {
      type: Type.OBJECT,
      properties: {
        pollOptions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        onScreenText: { type: Type.STRING },
      },
    },
  },
  required: ["name", "section", "postType", "headline", "subtitle", "cta", "legenda"],
} as const;

export const CONTENT_SCHEDULE_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: ITEM_SCHEMA,
    },
  },
  required: ["items"],
} as const;

async function callGeminiJson(
  operation: string,
  contents: { text: string }[],
  schema: typeof CONTENT_SCHEDULE_JSON_SCHEMA | { type: typeof Type.OBJECT; properties: { item: typeof ITEM_SCHEMA }; required: ["item"] }
): Promise<{ text: string; modelUsed: string }> {
  const ai = getClient();
  let modelUsed = getGeminiContentScheduleModel();
  const response = await callGeminiPlanning(
    getGeminiContentScheduleModel(),
    operation,
    (model) =>
      ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    { onSuccess: (model) => (modelUsed = model) }
  );
  await trackGeminiUsage(operation, modelUsed, response);
  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error("Gemini: o modelo respondeu sem texto.");
  }
  return { text: rawText, modelUsed };
}

function parseItems(rawText: string): RawScheduleItem[] {
  let parsed: { items?: RawScheduleItem[] };
  try {
    parsed = JSON.parse(rawText) as { items?: RawScheduleItem[] };
  } catch {
    throw new Error("Gemini: resposta JSON inválida.");
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (!items.length) {
    throw new Error("Gemini: nenhum item retornado.");
  }
  return items;
}

async function generateWithQualityRetry(
  gem: BrandGemConfig,
  clientBrief: string,
  options: ContentScheduleGenerateOptions,
  retryHint?: string
): Promise<ContentScheduleItem[]> {
  const task = buildContentScheduleTask(gem, clientBrief, options);
  const extra = retryHint ? `\n\n${retryHint}` : "";
  const { text } = await callGeminiJson(
    "generate_content_schedule",
    [{ text: task + extra }, { text: buildContentScheduleResultInstructions() }],
    CONTENT_SCHEDULE_JSON_SCHEMA
  );
  return normalizeRawScheduleItems(parseItems(text));
}

export async function generateContentSchedule(input: {
  brandGem?: BrandGemConfig;
  promptContext?: string;
  repeatingText?: BrandGemConfig["footer"];
  clientBrief: string;
  options: ContentScheduleGenerateOptions;
}): Promise<GeneratedContentScheduleItem[]> {
  const gem = resolveBrandGemFromBody(input);
  assertBrandGemReadyForCaptions(gem);

  let items = await generateWithQualityRetry(gem, input.clientBrief, input.options);
  const qualityIssues = assessScheduleItemsQuality(items).filter(
    (i) => i !== "missing_image_prompt"
  );
  if (qualityIssues.length > 0) {
    try {
      items = await generateWithQualityRetry(
        gem,
        input.clientBrief,
        input.options,
        COPY_QUALITY_RETRY_INSTRUCTION
      );
    } catch (error) {
      console.warn("[content-schedule] retry de qualidade falhou:", error);
    }
  }
  return items;
}

export async function generateSingleContentScheduleItem(input: {
  brandGem?: BrandGemConfig;
  promptContext?: string;
  repeatingText?: BrandGemConfig["footer"];
  clientBrief: string;
  section: "posts" | "stories";
  options: {
    startDate: string;
    extraInstructions?: string;
    itemInstruction?: string;
    existingItems?: ContentScheduleExistingItemSummary[];
    order: number;
  };
}): Promise<GeneratedContentScheduleItem> {
  const gem = resolveBrandGemFromBody(input);
  assertBrandGemReadyForCaptions(gem);

  const { text } = await callGeminiJson(
    "generate_content_schedule_item",
    [
      {
        text: buildContentScheduleSingleItemTask(
          gem,
          input.clientBrief,
          input.section,
          input.options
        ),
      },
      { text: buildContentScheduleResultInstructions() },
    ],
    CONTENT_SCHEDULE_JSON_SCHEMA
  );

  const raw = parseItems(text)[0];
  return normalizeRawScheduleItem(raw, input.section, input.options.order);
}

export async function refineContentScheduleItem(input: {
  brandGem?: BrandGemConfig;
  promptContext?: string;
  repeatingText?: BrandGemConfig["footer"];
  existingItem: GeneratedContentScheduleItem;
  refineInstruction: string;
}): Promise<GeneratedContentScheduleItem> {
  const gem = resolveBrandGemFromBody(input);
  assertBrandGemReadyForCaptions(gem);

  const { text } = await callGeminiJson(
    "refine_content_schedule",
    [
      {
        text: buildContentScheduleRefineTask(
          gem,
          input.existingItem as unknown as Record<string, unknown>,
          input.refineInstruction
        ),
      },
      { text: buildContentScheduleRefineResultInstructions() },
    ],
    {
      type: Type.OBJECT,
      properties: { item: ITEM_SCHEMA },
      required: ["item"],
    }
  );

  let parsed: { item?: RawScheduleItem };
  try {
    parsed = JSON.parse(text) as { item?: RawScheduleItem };
  } catch {
    throw new Error("Gemini: resposta JSON inválida ao refinar o item.");
  }

  const section = input.existingItem.section;
  const normalized = normalizeRawScheduleItem(parsed.item ?? {}, section, input.existingItem.order, {
    preserveId: input.existingItem.id,
    preserveStatus: input.existingItem.status,
    linkedPostId: input.existingItem.linkedPostId,
  });
  return normalized;
}

export async function strengthenContentScheduleItem(input: {
  brandGem?: BrandGemConfig;
  promptContext?: string;
  repeatingText?: BrandGemConfig["footer"];
  existingItem: GeneratedContentScheduleItem;
}): Promise<GeneratedContentScheduleItem> {
  return refineContentScheduleItem({
    ...input,
    refineInstruction:
      "Reforce a copy deste item: headline mais específica, frase de apoio mais densa (10-18 palavras), CTA mais variada e contundente. Mantenha o tema e a section. Melhore imagePrompt se estiver fraco. Stories: sem hashtags; legenda = texto de apoio curto.",
  });
}
