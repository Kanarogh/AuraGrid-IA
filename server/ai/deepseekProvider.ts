import { buildRefineCaptionPrompt, resolveBrandGemFromBody } from "./brandContext.ts";
import { getDeepSeekModel, hasDeepSeekKey } from "./config.ts";
import { withRetry } from "./shared.ts";
import type { AiProvider, CatalogEnrichInput, MatchGenerateInput, MatchGenerateResult } from "./types.ts";
import { requireVisionDelegate } from "./visionDelegate.ts";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getApiKey() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY não configurada no .env");
  return apiKey;
}

async function deepseekChat(
  messages: ChatMessage[],
  options: { jsonObject?: boolean; maxTokens?: number } = {}
): Promise<string> {
  const body: Record<string, unknown> = {
    model: getDeepSeekModel(),
    messages,
    temperature: 0.2,
    max_tokens: options.maxTokens ?? 4096,
    thinking: { type: "disabled" },
  };

  if (options.jsonObject) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let data: {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`DeepSeek retornou resposta inválida (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const msg = data.error?.message || raw.slice(0, 300) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("DeepSeek retornou resposta vazia.");
  return content;
}

export const deepseekProvider: AiProvider = {
  id: "deepseek",
  getModel: getDeepSeekModel,
  isConfigured: hasDeepSeekKey,

  /** DeepSeek API é só texto — indexação usa Groq ou Gemini se disponível. */
  async enrichCatalogItem(input: CatalogEnrichInput) {
    return requireVisionDelegate("indexação do catálogo").enrichCatalogItem(input);
  },

  /** Legendas com foto: visão via Groq/Gemini; DeepSeek fica para refinamento de texto. */
  async matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult> {
    return requireVisionDelegate("geração de legendas com foto").matchAndGenerate(input);
  },

  async refineCaption(input) {
    const { currentCaption, instructions } = input;
    const gem = resolveBrandGemFromBody(input);
    return withRetry(
      () =>
        deepseekChat([
          {
            role: "user",
            content: buildRefineCaptionPrompt(currentCaption, instructions, gem),
          },
        ]),
      "DeepSeek"
    );
  },
};
