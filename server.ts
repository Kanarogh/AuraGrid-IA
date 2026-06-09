import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import {
  buildAiSettingsResponse,
  buildHealthResponse,
  formatAiError,
  getActiveProvider,
  getActiveProviderId,
  setActiveAiProvider,
  setOpenRouterModelOverride,
} from "./server/ai/index.ts";
import { getEnvDefaultProviderId } from "./server/ai/config.ts";
import {
  clearOpenRouterModelsCache,
  listLiveOpenRouterModels,
} from "./server/ai/openrouterModelsLive.ts";
import type { OpenRouterModelsFilter } from "./server/ai/index.ts";
import { hasOpenRouterKey } from "./server/ai/config.ts";
import {
  getRuntimeProviderOverride,
  loadRuntimeAiSettings,
} from "./server/ai/runtimeSettings.ts";
import { applyAiHeadersFromRequest } from "./server/ai/requestContext.ts";
import { runVisionWithFallback } from "./server/ai/fallbackChain.ts";
import { setAiAttemptsHeader } from "./server/ai/httpHeaders.ts";
import { getCircuitBreakerSnapshot } from "./server/ai/circuitBreaker.ts";
import { getAiDiagnosticsSnapshot } from "./server/ai/diagnostics.ts";
import type { AiProviderId } from "./server/ai/types.ts";
import {
  assertBrandGemReadyForCaptions,
  resolveBrandGemFromBody,
} from "./server/ai/brandContext.ts";
import { sanitizeRefinedCaptionOutput } from "./server/ai/shared.ts";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/api/health", (_req, res) => {
  res.json(buildHealthResponse());
});

app.get("/api/ai/settings", async (req, res) => {
  const refresh = req.query.refresh === "1" || req.query.refresh === "true";
  res.json(await buildAiSettingsResponse({ refreshOpenRouter: refresh }));
});

app.get("/api/ai/openrouter-models", async (req, res) => {
  if (!hasOpenRouterKey()) {
    return res.json({
      models: [],
      filter: "vision-text",
      fetchedAt: null,
      fromCache: false,
      error: "OPENROUTER_API_KEY não configurada no .env",
    });
  }

  const filterRaw = String(req.query.filter ?? "vision-text");
  const filter: OpenRouterModelsFilter =
    filterRaw === "vision-image" || filterRaw === "vision-any"
      ? filterRaw
      : "vision-text";
  const refresh = req.query.refresh === "1" || req.query.refresh === "true";
  if (refresh) clearOpenRouterModelsCache();

  try {
    const result = await listLiveOpenRouterModels(process.env.OPENROUTER_API_KEY!.trim(), {
      refresh,
      filter,
    });
    return res.json({
      filter,
      filterUrls: {
        visionText:
          "https://openrouter.ai/models?output_modalities=text&input_modalities=image",
        visionImage:
          "https://openrouter.ai/models?output_modalities=image&input_modalities=image",
      },
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(502).json({ error: message, models: [] });
  }
});

app.put("/api/ai/openrouter-model", async (req, res) => {
  try {
    const { model } = req.body as { model?: string | null };
    if (model !== null && (typeof model !== "string" || !model.trim())) {
      return res.status(400).json({ error: "model deve ser string ou null." });
    }
    if (model && !model.includes("/")) {
      return res.status(400).json({ error: "ID de modelo OpenRouter inválido." });
    }
    await setOpenRouterModelOverride(model);
    res.json(await buildAiSettingsResponse());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Falha ao trocar modelo.";
    res.status(400).json({ error: message });
  }
});

app.put("/api/ai/settings", async (req, res) => {
  try {
    const { provider } = req.body as { provider?: string };
    if (
      provider !== "gemini" &&
      provider !== "groq" &&
      provider !== "openrouter" &&
      provider !== "ollama"
    ) {
      return res
        .status(400)
        .json({ error: "Provedor inválido. Use: gemini, groq, openrouter ou ollama." });
    }
    await setActiveAiProvider(provider as AiProviderId);
    res.json(await buildAiSettingsResponse());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Falha ao trocar provedor.";
    res.status(400).json({ error: message });
  }
});

app.post("/api/enrich-catalog-item", async (req, res) => {
  let providerId = await applyAiHeadersFromRequest(req);
  try {
    const { image, label, id } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No catalog image provided." });
    }

    const outcome = await runVisionWithFallback(
      "enrich-catalog-item",
      (provider) => provider.enrichCatalogItem({ image, label, id }),
      providerId
    );

    providerId = outcome.providerUsed;
    res.setHeader("X-AI-Provider-Used", outcome.providerUsed);
    if (outcome.modelLabel) res.setHeader("X-AI-Model-Used", outcome.modelLabel);
    setAiAttemptsHeader(res, outcome.attempts);
    return res.json({
      profile: outcome.result,
      providerUsed: outcome.providerUsed,
      modelUsed: outcome.modelLabel,
    });
  } catch (error: unknown) {
    console.error("Error enriching catalog item:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return res.status(status).json({ error: formatAiError(error, providerId) });
  }
});

app.post("/api/match-and-generate", async (req, res) => {
  let providerId = await applyAiHeadersFromRequest(req);
  try {
    const { postImage, catalogItems, catalogProfiles, brandGem, promptContext, repeatingText, regenerateCaption, captionFromImageOnly } =
      req.body;

    if (!postImage) {
      return res.status(400).json({ error: "No post image provided." });
    }

    try {
      assertBrandGemReadyForCaptions(
        brandGem ?? resolveBrandGemFromBody({ promptContext, repeatingText })
      );
    } catch (validationError: unknown) {
      return res.status(400).json({
        error: validationError instanceof Error ? validationError.message : String(validationError),
      });
    }

    const imageOnly = !!captionFromImageOnly;
    const profiles = Array.isArray(catalogProfiles) ? catalogProfiles : [];
    const items = Array.isArray(catalogItems) ? catalogItems : [];

    if (!imageOnly) {
      if (items.length > 0 && profiles.length === 0) {
        return res.status(400).json({
          error:
            "Catálogo não indexado. Indexe todas as referências (JSON) antes de gerar legendas — a comparação usa os perfis indexados, não as fotos do acervo.",
        });
      }
      if (
        profiles.length > 0 &&
        !profiles.every((p) => p?.id && p?.label && p?.profile)
      ) {
        return res.status(400).json({
          error: "catalogProfiles incompleto. Indexe todas as referências antes de gerar legendas.",
        });
      }
    }

    const outcome = await runVisionWithFallback(
      "match-and-generate",
      (provider) =>
        provider.matchAndGenerate({
          postImage,
          catalogItems: imageOnly ? undefined : catalogItems,
          catalogProfiles: imageOnly ? undefined : catalogProfiles,
          brandGem,
          promptContext,
          repeatingText,
          regenerateCaption: !!regenerateCaption,
          captionFromImageOnly: imageOnly,
        }),
      providerId
    );

    providerId = outcome.providerUsed;
    res.setHeader("X-AI-Provider-Used", outcome.providerUsed);
    res.setHeader("X-AI-Match-Mode", outcome.result.matchMode);
    setAiAttemptsHeader(res, outcome.attempts);
    return res.json({ ...outcome.result, providerUsed: outcome.providerUsed });
  } catch (error: unknown) {
    console.error("Error matching post & generating caption:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return res.status(status).json({ error: formatAiError(error, providerId) });
  }
});

app.post("/api/match-reference", async (req, res) => {
  let providerId = await applyAiHeadersFromRequest(req);
  try {
    const { postImage, catalogItems, catalogProfiles } = req.body;

    if (!postImage) {
      return res.status(400).json({ error: "No query image provided." });
    }

    const outcome = await runVisionWithFallback(
      "match-reference",
      (provider) =>
        provider.matchAndGenerate({
          postImage,
          catalogItems,
          catalogProfiles,
          matchOnly: true,
        }),
      providerId
    );

    providerId = outcome.providerUsed;
    res.setHeader("X-AI-Provider-Used", outcome.providerUsed);
    res.setHeader("X-AI-Match-Mode", outcome.result.matchMode);
    setAiAttemptsHeader(res, outcome.attempts);
    return res.json({
      matchedId: outcome.result.matchedId,
      reasoning: outcome.result.reasoning,
      matchMode: outcome.result.matchMode,
      providerUsed: outcome.providerUsed,
    });
  } catch (error: unknown) {
    console.error("Error matching catalog reference:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return res.status(status).json({ error: formatAiError(error, providerId) });
  }
});

app.get("/api/ai/circuit-breaker", (_req, res) => {
  res.json(getCircuitBreakerSnapshot());
});

app.get("/api/ai/diagnostics", (_req, res) => {
  res.json(getAiDiagnosticsSnapshot());
});

app.post("/api/refine-caption", async (req, res) => {
  const providerId = await applyAiHeadersFromRequest(req);
  try {
    const { currentCaption, instructions, brandGem, promptContext, repeatingText } = req.body;
    if (!currentCaption) {
      return res.status(400).json({ error: "Missing caption to refine." });
    }

    try {
      assertBrandGemReadyForCaptions(
        brandGem ?? resolveBrandGemFromBody({ promptContext, repeatingText })
      );
    } catch (validationError: unknown) {
      return res.status(400).json({
        error: validationError instanceof Error ? validationError.message : String(validationError),
      });
    }

    const provider = getActiveProvider();
    if (!String(instructions ?? "").trim()) {
      return res.status(400).json({ error: "Informe como deseja refinar a legenda." });
    }

    const caption = await provider.refineCaption({
      currentCaption,
      instructions,
      brandGem,
      promptContext,
      repeatingText,
    });
    return res.json({ caption: sanitizeRefinedCaptionOutput(caption) });
  } catch (error: unknown) {
    console.error("Error refining caption:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return res.status(status).json({ error: formatAiError(error, providerId) });
  }
});

async function initServer() {
  await loadRuntimeAiSettings();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const providerId = getActiveProviderId();
  let model = "—";
  try {
    model = getActiveProvider().getModel();
  } catch {
    model = `${providerId} (sem chave)`;
  }

  const envDefault = getEnvDefaultProviderId();
  const runtimeChoice = getRuntimeProviderOverride();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Server running on http://0.0.0.0:${PORT} — IA ativa: ${providerId} (${model})${
        runtimeChoice
          ? ` [escolhido na plataforma; .env padrão: ${envDefault}]`
          : ` [padrão do .env: ${envDefault}]`
      }`
    );
  });
}

initServer();
