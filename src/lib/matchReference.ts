import type { CatalogItem } from "../types";
import { readJsonResponse } from "./apiResponse";
import { aiFetch } from "./aiFetch";
import { getReferenceCatalog } from "./catalog";
import { convertSvgToDataUrl, resizeForAi } from "./images";
import { aiQueue } from "./aiQueue";

export type MatchReferenceResult = {
  matchedId: string | null;
  reasoning: string;
  matchMode?: string;
  providerUsed?: string;
};

export async function buildMatchReferenceBody(
  queryImageDataUrl: string,
  catalog: CatalogItem[]
): Promise<{ body: Record<string, unknown>; useJsonMatch: boolean }> {
  const refs = getReferenceCatalog(catalog);
  const ready = refs.filter((c) => c.enrichmentStatus === "ready" && c.visualProfile);
  const useJsonMatch = ready.length > 0 && ready.length === refs.length;

  const body: Record<string, unknown> = {
    postImage: queryImageDataUrl,
  };

  if (useJsonMatch) {
    body.catalogProfiles = ready.map((c) => ({
      id: c.id,
      label: c.label,
      profile: c.visualProfile,
    }));
  } else if (refs.length > 0) {
    const processedCatalog = await Promise.all(
      refs.map(async (item) => {
        const converted = await convertSvgToDataUrl(item.image);
        const compressed = await resizeForAi(converted, { maxSide: 768 });
        return { id: item.id, label: item.label, image: compressed };
      })
    );
    body.catalogItems = processedCatalog;
  }

  return { body, useJsonMatch };
}

export async function matchReferenceOnServer(
  queryImageDataUrl: string,
  catalog: CatalogItem[],
  signal?: AbortSignal
): Promise<MatchReferenceResult> {
  const processed = await resizeForAi(await convertSvgToDataUrl(queryImageDataUrl));
  const { body } = await buildMatchReferenceBody(processed, catalog);

  const response = await aiQueue.enqueue("Buscar referência", () =>
    aiFetch("/api/match-reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    })
  );

  const result = await readJsonResponse<{
    matchedId?: string | null;
    reasoning?: string;
    matchMode?: string;
    error?: string;
  }>(response);

  if (!response.ok) {
    throw new Error(result.error || "Falha ao buscar referência no servidor.");
  }

  return {
    matchedId: result.matchedId ?? null,
    reasoning: result.reasoning ?? "",
    matchMode: result.matchMode,
    providerUsed: response.headers.get("X-AI-Provider-Used") ?? undefined,
  };
}
