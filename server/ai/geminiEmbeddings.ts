import { GoogleGenAI } from "@google/genai";
import { GEMINI_EMBEDDING_DIMENSIONS, getGeminiEmbeddingModel } from "./matchConfig";
import { hasGeminiKey } from "./config";
import { recordAiUsageEvent } from "../services/aiUsageService";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aurastudio-build" } },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (m) return { mimeType: m[1]!, data: m[2]! };
  return { mimeType: "image/jpeg", data: dataUrl };
}

async function embedImage(
  dataUrl: string,
  taskPrefix: string,
  operation: "embed_catalog_image" | "embed_query_image"
): Promise<number[]> {
  const client = getClient();
  const { mimeType, data } = parseDataUrl(dataUrl);
  const model = getGeminiEmbeddingModel();

  const response = await client.models.embedContent({
    model,
    contents: [
      {
        parts: [
          { text: taskPrefix },
          { inlineData: { mimeType, data } },
        ],
      },
    ],
    config: {
      outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS,
    },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error("Gemini embedding retornou vetor vazio.");
  }
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
  return values;
}

export function isGeminiEmbeddingConfigured(): boolean {
  return hasGeminiKey();
}

/** Vetor para indexar referência do catálogo (híbrido: imagem + descrição do perfil). */
export async function embedCatalogImage(
  dataUrl: string,
  profileText?: string
): Promise<number[]> {
  const description = profileText?.trim();
  const taskPrefix = description
    ? `task: search document | reference description: ${description} | image:`
    : "task: search document | query: visual catalog reference item";
  return embedImage(dataUrl, taskPrefix, "embed_catalog_image");
}

/** Vetor para consulta (foto do post). */
export async function embedQueryImage(dataUrl: string): Promise<number[]> {
  return embedImage(
    dataUrl,
    "task: search query | query: social media post visual content",
    "embed_query_image"
  );
}
