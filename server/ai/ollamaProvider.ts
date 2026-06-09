import {
  buildRefineCaptionPrompt,
  resolveBrandGemFromBody,
} from "./brandContext";
import {
  buildEnrichCatalogPrompt,
  coerceCatalogProfile,
  finalizeCatalogProfile,
  IncompleteCatalogProfileError,
} from "./catalogProfile";
import {
  buildMatchJsonCatalogTask,
  buildMatchImagesCatalogTask,
  buildCatalogProfilesPromptSection,
  buildMatchResultInstructions,
  buildImageOnlyCaptionTask,
  buildImageOnlyResultInstructions,
  buildCaptionPromptOptions,
  isImageOnlyCaptionMode,
  MATCH_REFERENCE_RESPONSE_HINT,
  MATCH_RESPONSE_HINT,
  normalizeMatchedId,
  resolveMatchedIdFromCandidates,
} from "./matchPrompts";
import { getOllamaBaseUrl, getOllamaModel, getOllamaNumCtx, isOllamaConfigured } from "./config";
import { logAiAttemptFail } from "./diagnostics";
import { shrinkVisionImage } from "./imagePayload";
import { buildPostFingerprintPrompt, normalizePostFingerprint } from "./postFingerprint";
import { cleanBase64, withRetry } from "./shared";
import type {
  AiProvider,
  CatalogEnrichInput,
  MatchGenerateInput,
  MatchGenerateResult,
} from "./types";

type OllamaMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  images?: string[];
};

function base64Payload(image: string): string {
  const { data } = cleanBase64(image);
  return data;
}

async function ollamaVisionImage(image: string): Promise<string> {
  const dataUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${base64Payload(image)}`;
  return shrinkVisionImage(dataUrl, { maxSide: 512, quality: 0.72 });
}

/** Extrai o primeiro JSON válido de uma string que pode conter prosa/markdown. */
function extractJson(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];

  return trimmed;
}

type OllamaChatMessage = {
  role?: string;
  content?: string;
  thinking?: string;
};

/** Gemma 4 pode colocar JSON só em `thinking` ou misturar raciocínio no texto. */
function extractAssistantText(message: OllamaChatMessage | undefined): string {
  if (!message) return "";
  const content = message.content?.trim() ?? "";
  const thinking = message.thinking?.trim() ?? "";

  if (content) {
    const fromContent = extractJson(content);
    if (fromContent.startsWith("{")) return fromContent;
    if (thinking) {
      const fromThinking = extractJson(thinking);
      if (fromThinking.startsWith("{")) return fromThinking;
    }
    return content;
  }

  if (thinking) {
    const fromThinking = extractJson(thinking);
    if (fromThinking.startsWith("{")) return fromThinking;
    return thinking;
  }

  return "";
}

function parseOllamaTimeoutMs(): number {
  const raw = process.env.OLLAMA_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 180_000;
  return Number.isFinite(n) && n > 0 ? n : 180_000;
}

function partsToOllamaMessage(
  parts: Array<{ type: "text"; text: string } | { type: "image"; image: string }>
): OllamaMessage {
  const texts: string[] = [];
  const images: string[] = [];
  for (const p of parts) {
    if (p.type === "text" && p.text.trim()) texts.push(p.text.trim());
    if (p.type === "image") images.push(base64Payload(p.image));
  }
  return {
    role: "user",
    content: texts.join("\n\n"),
    ...(images.length ? { images } : {}),
  };
}

async function ollamaChat(
  messages: OllamaMessage[],
  options: { jsonMode?: boolean; maxTokens?: number } = {}
): Promise<string> {
  const model = getOllamaModel();
  const baseUrl = getOllamaBaseUrl().replace(/\/$/, "");
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    /** Gemma 4: sem isso o modelo “pensa” e atrasa / atrapalha JSON. */
    think: false,
    options: {
      temperature: 0.2,
      num_predict: options.maxTokens ?? 4096,
      num_ctx: getOllamaNumCtx(),
    },
  };

  if (options.jsonMode) {
    body.format = "json";
  }

  const timeoutMs = parseOllamaTimeoutMs();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const msg =
      err instanceof Error && /timed out|TimeoutError|aborted/i.test(err.name + err.message)
        ? `Ollama demorou mais de ${Math.round(timeoutMs / 1000)}s (visão local é lenta na 1ª foto). Aumente OLLAMA_TIMEOUT_MS no .env ou aguarde o modelo carregar.`
        : err instanceof Error && /fetch failed|ECONNREFUSED/i.test(err.message)
          ? `Ollama não está acessível em ${baseUrl}. Instale o Ollama, execute \`ollama pull ${model}\` e deixe o app rodando.`
          : err instanceof Error
            ? err.message
            : String(err);
    const error = new Error(msg);
    logAiAttemptFail("ollama-chat", "ollama", error, { model, detail: msg });
    throw error;
  }

  const raw = await res.text();
  let data: { message?: OllamaChatMessage; error?: string };
  try {
    data = JSON.parse(raw);
  } catch {
    const err = new Error(`Ollama retornou resposta inválida (HTTP ${res.status}).`);
    logAiAttemptFail("ollama-chat", "ollama", err, {
      model,
      httpStatus: res.status,
      detail: raw.slice(0, 400),
    });
    throw err;
  }

  if (!res.ok) {
    const detail = data.error || raw.slice(0, 300) || `HTTP ${res.status}`;
    const detailStr = String(detail);
    const ctxHint = /exceed.*context|context size|n_ctx/i.test(detailStr)
      ? ` Aumente OLLAMA_NUM_CTX no .env (ex.: 32768) ou use modelo com mais contexto (qwen2.5vl:7b).`
      : "";
    const authHint = /unauthorized/i.test(detailStr)
      ? model.includes(":cloud")
        ? ` Modelos *:cloud exigem conta/login no app Ollama. Troque no .env para OLLAMA_MODEL=gemma4 (local).`
        : ` Faça login no app Ollama ou use OLLAMA_MODEL=gemma4 (modelo local).`
      : "";
    const err = new Error(
      /model.*not found|pull/i.test(detailStr)
        ? `Modelo "${model}" não encontrado no Ollama. Execute: ollama pull ${model}`
        : `Ollama: ${detail}${ctxHint}${authHint}`
    );
    logAiAttemptFail("ollama-chat", "ollama", err, { model, httpStatus: res.status, detail });
    throw err;
  }

  const content = extractAssistantText(data.message);
  if (!content) {
    const err = new Error(
      `Ollama retornou resposta vazia (modelo: ${model}). Confirme think:false e reinicie o Ollama.`
    );
    logAiAttemptFail("ollama-chat", "ollama", err, { model, detail: raw.slice(0, 400) });
    throw err;
  }

  return content;
}

async function ollamaChatCatalogJson(
  messages: OllamaMessage[],
  label?: string
): Promise<Record<string, unknown>> {
  const content = await withRetry(
    () => ollamaChat(messages, { jsonMode: true, maxTokens: 8192 }),
    "Ollama"
  );

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJson(content)) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Ollama devolveu texto que não é JSON válido. Trecho: ${content.slice(0, 180)}…`
    );
  }

  try {
    return finalizeCatalogProfile(parsed, label);
  } catch (err) {
    if (!(err instanceof IncompleteCatalogProfileError)) throw err;
    return finalizeCatalogProfile(coerceCatalogProfile(parsed, label), label);
  }
}

export const ollamaProvider: AiProvider = {
  id: "ollama",
  getModel: getOllamaModel,
  isConfigured: isOllamaConfigured,

  async analyzePostVisual({ postImage }) {
    const image = await ollamaVisionImage(postImage);
    const content = await withRetry(
      () =>
        ollamaChat(
          [
            partsToOllamaMessage([
              { type: "text", text: `${buildPostFingerprintPrompt()}\n\nReturn ONLY valid JSON.` },
              { type: "image", image },
            ]),
          ],
          { jsonMode: true, maxTokens: 1024 }
        ),
      "Ollama"
    );
    return normalizePostFingerprint(JSON.parse(extractJson(content)) as Record<string, unknown>);
  },

  async enrichCatalogItem({ image, label, id }: CatalogEnrichInput) {
    const visionImage = await ollamaVisionImage(image);
    const prompt = `${buildEnrichCatalogPrompt(label, id)}\n\nReturn ONLY valid JSON matching the catalog profile schema. No markdown, no explanation.`;

    return ollamaChatCatalogJson(
      [
        partsToOllamaMessage([
          { type: "text", text: prompt },
          { type: "image", image: visionImage },
        ]),
      ],
      label
    );
  },

  async matchAndGenerate(input: MatchGenerateInput): Promise<MatchGenerateResult> {
    const { postImage, matchOnly, regenerateCaption } = input;
    const catalogProfiles = input.catalogProfiles;
    const catalogItems = input.catalogProfiles?.length ? undefined : input.catalogItems;
    const gem = resolveBrandGemFromBody(input);
    const visionPost = await ollamaVisionImage(postImage);

    if (isImageOnlyCaptionMode(input)) {
      const parts: Array<
        { type: "text"; text: string } | { type: "image"; image: string }
      > = [
        { type: "text", text: buildImageOnlyCaptionTask(gem) },
        { type: "image", image: visionPost },
        {
          type: "text",
          text: `${buildImageOnlyResultInstructions(gem, buildCaptionPromptOptions(input, true))}\n\n${MATCH_RESPONSE_HINT}`,
        },
      ];

      const raw = await withRetry(
        () => ollamaChat([partsToOllamaMessage(parts)], { jsonMode: true }),
        "Ollama"
      );

      const parsed = JSON.parse(extractJson(raw)) as Omit<MatchGenerateResult, "matchMode"> & {
        matchedId?: string | null;
        caption?: string;
      };
      return {
        matchedId: null,
        reasoning: parsed.reasoning ?? "",
        caption: parsed.caption ?? "",
        matchMode: "image_only",
      };
    }

    const profiles = Array.isArray(catalogProfiles) ? catalogProfiles : [];
    const useTextCatalog =
      profiles.length > 0 && profiles.every((p) => p?.profile);

    const parts: Array<
      { type: "text"; text: string } | { type: "image"; image: string }
    > = [];

    if (useTextCatalog) {
      parts.push({
        type: "text",
        text: buildMatchJsonCatalogTask(!!matchOnly, gem),
      });
      parts.push({ type: "image", image: visionPost });
      parts.push({
        type: "text",
        text: buildCatalogProfilesPromptSection(profiles, {
          brief: true,
          ultraCompact: false,
          matchRankHint: input.matchRankHint,
        }),
      });
    } else {
      parts.push({
        type: "text",
        text: buildMatchImagesCatalogTask(!!matchOnly, gem),
      });
      parts.push({ type: "image", image: visionPost });

      if (catalogItems && catalogItems.length > 0) {
        const maxImages = 3;
        const slice = catalogItems.slice(0, maxImages);
        if (catalogItems.length > maxImages) {
          parts.push({
            type: "text",
            text: `(Showing ${maxImages} of ${catalogItems.length} candidates — prefer visible IDs.)`,
          });
        }
        for (const [idx, item] of slice.entries()) {
          const candidateImage = await ollamaVisionImage(item.image);
          parts.push({
            type: "text",
            text: `[CANDIDATE #${idx + 1}] ID: "${item.id}" Label: "${item.label}"`,
          });
          parts.push({ type: "image", image: candidateImage });
        }
      } else {
        parts.push({ type: "text", text: "No catalog candidates — matchedId null." });
      }
    }

    const hint = matchOnly ? MATCH_REFERENCE_RESPONSE_HINT : MATCH_RESPONSE_HINT;
    parts.push({
      type: "text",
      text: `${buildMatchResultInstructions(gem, !!matchOnly, buildCaptionPromptOptions(input, true))}\n\n${hint}`,
    });

    const raw = await withRetry(
      () => ollamaChat([partsToOllamaMessage(parts)], { jsonMode: true }),
      "Ollama"
    );

    const parsed = JSON.parse(extractJson(raw)) as Omit<MatchGenerateResult, "matchMode"> & {
      matchedId?: string | null;
      caption?: string;
    };
    const candidateProfiles = useTextCatalog
      ? profiles.map((p) => ({ id: p.id, label: p.label }))
      : (catalogItems ?? []).map((c) => ({ id: c.id, label: c.label }));
    const resolvedId = resolveMatchedIdFromCandidates(parsed.matchedId, candidateProfiles);
    if (!resolvedId && parsed.matchedId) {
      console.warn(
        `[ollama] matchedId rejeitado (não está nos candidatos): ${String(parsed.matchedId).slice(0, 80)}`
      );
    } else if (!resolvedId && input.matchRankHint) {
      console.info(
        `[ollama] matchedId null — pre-rank top=${input.matchRankHint.candidateId} score=${input.matchRankHint.score} gap=${input.matchRankHint.scoreGap}`
      );
    }
    return {
      matchedId: resolvedId,
      reasoning: parsed.reasoning ?? "",
      caption: matchOnly ? "" : (parsed.caption ?? ""),
      matchMode: useTextCatalog ? "catalog_json" : "catalog_images",
    };
  },

  async refineCaption(input) {
    const { currentCaption, instructions } = input;
    const gem = resolveBrandGemFromBody(input);
    return withRetry(
      () =>
        ollamaChat([
          {
            role: "user",
            content: buildRefineCaptionPrompt(currentCaption, instructions, gem),
          },
        ]),
      "Ollama"
    );
  },
};

/** Verifica se o daemon Ollama responde (health / settings). */
export async function probeOllamaReachable(): Promise<boolean> {
  if (!isOllamaConfigured()) return false;
  const baseUrl = getOllamaBaseUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}
