import { GoogleGenAI } from "@google/genai";
import { GEMINI_EMBEDDING_DIMENSIONS, getGeminiEmbeddingModel } from "./matchConfig";
import { hasGeminiKey } from "./config";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "auragrid-build" } },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (m) return { mimeType: m[1]!, data: m[2]! };
  return { mimeType: "image/jpeg", data: dataUrl };
}

async function embedImage(dataUrl: string, taskPrefix: string): Promise<number[]> {
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
  return values;
}

export function isGeminiEmbeddingConfigured(): boolean {
  return hasGeminiKey();
}

/** Vetor para indexar referência do catálogo. */
export async function embedCatalogImage(dataUrl: string): Promise<number[]> {
  return embedImage(dataUrl, "task: search document | query: fashion catalog reference garment");
}

/** Vetor para consulta (foto do post). */
export async function embedQueryImage(dataUrl: string): Promise<number[]> {
  return embedImage(dataUrl, "task: search query | query: fashion post outfit photo");
}
