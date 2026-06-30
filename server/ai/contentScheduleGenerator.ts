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
  buildContentScheduleResultInstructions,
  buildContentScheduleSingleItemTask,
  buildContentScheduleTask,
  type ContentScheduleExistingItemSummary,
  type ContentScheduleGenerateOptions,
} from "./contentSchedulePrompts";

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

type ContentScheduleSection = "posts" | "stories";

type ContentScheduleItemStatus = "draft" | "approved" | "handed_off" | "done";

export type GeneratedContentScheduleItem = {
  id: string;
  order: number;
  section: ContentScheduleSection;
  name: string;
  postType: string;
  scheduledDate?: string;
  status: ContentScheduleItemStatus;
  headline: string;
  subtitle: string;
  cta: string;
  legenda: string;
  hashtags: string;
  storyExtras?: {
    pollOptions?: [string, string];
    onScreenText?: string;
  };
  linkedPostId?: string;
};

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

function createScheduleItemId(section: ContentScheduleSection, order: number): string {
  return `schedule_${section}_${order}_${Date.now()}`;
}

export const CONTENT_SCHEDULE_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
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
      },
    },
  },
  required: ["items"],
} as const;

type RawItem = {
  name?: string;
  section?: string;
  postType?: string;
  headline?: string;
  subtitle?: string;
  cta?: string;
  legenda?: string;
  hashtags?: string;
  suggestedDate?: string;
  storyExtras?: {
    pollOptions?: string[];
    onScreenText?: string;
  };
};

function normalizeRawItem(
  item: RawItem,
  section: ContentScheduleSection,
  order: number
): GeneratedContentScheduleItem {
  const poll =
    item.storyExtras?.pollOptions?.length === 2
      ? ([item.storyExtras.pollOptions[0], item.storyExtras.pollOptions[1]] as [string, string])
      : undefined;
  return {
    id: createScheduleItemId(section, order),
    order,
    section,
    name: item.name?.trim() || (section === "posts" ? `POST ${order}` : `STORY ${order}`),
    postType: item.postType?.trim() || (section === "posts" ? "Arte Única" : "Story"),
    scheduledDate: item.suggestedDate?.trim(),
    status: "draft" as const,
    headline: item.headline?.trim() ?? "",
    subtitle: item.subtitle?.trim() ?? "",
    cta: item.cta?.trim() ?? "",
    legenda: item.legenda?.trim() ?? "",
    hashtags: item.hashtags?.trim() ?? "",
    storyExtras:
      poll || item.storyExtras?.onScreenText
        ? {
            pollOptions: poll,
            onScreenText: item.storyExtras?.onScreenText?.trim(),
          }
        : undefined,
  };
}

function normalizeRawItems(raw: RawItem[]): GeneratedContentScheduleItem[] {
  return raw.map((item, index) => {
    const section = item.section === "stories" ? "stories" : "posts";
    return normalizeRawItem(item, section, index + 1);
  });
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

  const ai = getClient();
  let modelUsed = getGeminiContentScheduleModel();
  const response = await callGeminiPlanning(
    getGeminiContentScheduleModel(),
    "Gemini content schedule",
    (model) =>
      ai.models.generateContent({
        model,
        contents: [
          { text: buildContentScheduleTask(gem, input.clientBrief, input.options) },
          { text: buildContentScheduleResultInstructions() },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: CONTENT_SCHEDULE_JSON_SCHEMA,
        },
      })
  ,
    { onSuccess: (model) => (modelUsed = model) }
  );
  await trackGeminiUsage("generate_content_schedule", modelUsed, response);

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error("Gemini: o modelo respondeu sem texto (cronograma vazio).");
  }

  let parsed: { items?: RawItem[] };
  try {
    parsed = JSON.parse(rawText) as { items?: RawItem[] };
  } catch {
    throw new Error("Gemini: resposta JSON inválida ao gerar o cronograma.");
  }

  const items = normalizeRawItems(Array.isArray(parsed.items) ? parsed.items : []);
  if (!items.length) {
    throw new Error("Gemini: nenhum item retornado no cronograma.");
  }
  return items;
}

export async function generateSingleContentScheduleItem(input: {
  brandGem?: BrandGemConfig;
  promptContext?: string;
  repeatingText?: BrandGemConfig["footer"];
  clientBrief: string;
  section: ContentScheduleSection;
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

  const ai = getClient();
  let modelUsed = getGeminiContentScheduleModel();
  const response = await callGeminiPlanning(
    getGeminiContentScheduleModel(),
    "Gemini content schedule single item",
    (model) =>
      ai.models.generateContent({
        model,
        contents: [
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
        config: {
          responseMimeType: "application/json",
          responseSchema: CONTENT_SCHEDULE_JSON_SCHEMA,
        },
      }),
    { onSuccess: (model) => (modelUsed = model) }
  );
  await trackGeminiUsage("generate_content_schedule_item", modelUsed, response);

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error("Gemini: o modelo respondeu sem texto (item vazio).");
  }

  let parsed: { items?: RawItem[] };
  try {
    parsed = JSON.parse(rawText) as { items?: RawItem[] };
  } catch {
    throw new Error("Gemini: resposta JSON inválida ao criar item.");
  }

  const raw = Array.isArray(parsed.items) ? parsed.items[0] : undefined;
  if (!raw) throw new Error("Gemini: nenhum item retornado.");
  return normalizeRawItem(raw, input.section, input.options.order);
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

  const ai = getClient();
  let modelUsed = getGeminiContentScheduleModel();
  const response = await callGeminiPlanning(
    getGeminiContentScheduleModel(),
    "Gemini content schedule refine",
    (model) =>
      ai.models.generateContent({
        model,
        contents: [
          {
            text: buildContentScheduleRefineTask(
              gem,
              input.existingItem as unknown as Record<string, unknown>,
              input.refineInstruction
            ),
          },
          { text: buildContentScheduleResultInstructions() },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              item: CONTENT_SCHEDULE_JSON_SCHEMA.properties.items.items,
            },
            required: ["item"],
          },
        },
      })
  ,
    { onSuccess: (model) => (modelUsed = model) }
  );
  await trackGeminiUsage("refine_content_schedule", modelUsed, response);

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error("Gemini: o modelo respondeu sem texto ao refinar o item.");
  }

  let parsed: { item?: RawItem };
  try {
    parsed = JSON.parse(rawText) as { item?: RawItem };
  } catch {
    throw new Error("Gemini: resposta JSON inválida ao refinar o item.");
  }

  const [normalized] = normalizeRawItems(parsed.item ? [parsed.item] : []);
  if (!normalized) throw new Error("IA não retornou item refinado.");
  return {
    ...normalized,
    id: input.existingItem.id,
    order: input.existingItem.order,
    status: input.existingItem.status,
    linkedPostId: input.existingItem.linkedPostId,
  };
}
