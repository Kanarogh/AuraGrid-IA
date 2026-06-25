import { GoogleGenAI, Type } from "@google/genai";
import {
  assertBrandGemReadyForCaptions,
  resolveBrandGemFromBody,
  type BrandGemConfig,
} from "./brandContext";
import { getGeminiModel } from "./config";
import { withRetry } from "./shared";
import {
  buildContentScheduleRefineTask,
  buildContentScheduleResultInstructions,
  buildContentScheduleTask,
  type ContentScheduleGenerateOptions,
} from "./contentSchedulePrompts";

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
    httpOptions: { headers: { "User-Agent": "auragrid-build" } },
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

function normalizeRawItems(raw: RawItem[]): GeneratedContentScheduleItem[] {
  return raw.map((item, index) => {
    const section = item.section === "stories" ? "stories" : "posts";
    const order = index + 1;
    const poll =
      item.storyExtras?.pollOptions?.length === 2
        ? ([item.storyExtras.pollOptions[0], item.storyExtras.pollOptions[1]] as [
            string,
            string,
          ])
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
  const model = getGeminiModel();
  const response = await withRetry(
    () =>
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
      }),
    "Gemini"
  );

  const parsed = JSON.parse(response.text || "{}") as { items?: RawItem[] };
  return normalizeRawItems(Array.isArray(parsed.items) ? parsed.items : []);
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
  const model = getGeminiModel();
  const response = await withRetry(
    () =>
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
      }),
    "Gemini"
  );

  const parsed = JSON.parse(response.text || "{}") as { item?: RawItem };
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
