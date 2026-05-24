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
import { isKnownOpenRouterModel } from "./server/ai/openrouterModels.ts";
import {
  getRuntimeProviderOverride,
  loadRuntimeAiSettings,
} from "./server/ai/runtimeSettings.ts";
import { applyAiHeadersFromRequest } from "./server/ai/requestContext.ts";
import { runVisionWithFallback } from "./server/ai/fallbackChain.ts";
import { getCircuitBreakerSnapshot } from "./server/ai/circuitBreaker.ts";
import { getAiDiagnosticsSnapshot } from "./server/ai/diagnostics.ts";
import type { AiProviderId } from "./server/ai/types.ts";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/api/health", (_req, res) => {
  res.json(buildHealthResponse());
});

app.get("/api/ai/settings", (_req, res) => {
  res.json(buildAiSettingsResponse());
});

app.put("/api/ai/openrouter-model", async (req, res) => {
  try {
    const { model } = req.body as { model?: string | null };
    if (model !== null && (typeof model !== "string" || !model.trim())) {
      return res.status(400).json({ error: "model deve ser string ou null." });
    }
    if (model && !isKnownOpenRouterModel(model) && !/:free$|:nitro$/.test(model)) {
      console.warn(`OpenRouter: modelo customizado fora da curadoria — ${model}`);
    }
    await setOpenRouterModelOverride(model);
    res.json(buildAiSettingsResponse());
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
      provider !== "deepseek" &&
      provider !== "openrouter"
    ) {
      return res
        .status(400)
        .json({ error: "Provedor inválido. Use: gemini, groq, deepseek ou openrouter." });
    }
    await setActiveAiProvider(provider as AiProviderId);
    res.json(buildAiSettingsResponse());
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
    res.setHeader("X-AI-Attempts", JSON.stringify(outcome.attempts));
    return res.json({ profile: outcome.result, providerUsed: outcome.providerUsed });
  } catch (error: unknown) {
    console.error("Error enriching catalog item:", error);
    const status = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(String(error)) ? 429 : 500;
    return res.status(status).json({ error: formatAiError(error, providerId) });
  }
});

app.post("/api/match-and-generate", async (req, res) => {
  let providerId = await applyAiHeadersFromRequest(req);
  try {
    const { postImage, catalogItems, catalogProfiles, promptContext, repeatingText } = req.body;

    if (!postImage) {
      return res.status(400).json({ error: "No post image provided." });
    }

    const outcome = await runVisionWithFallback(
      "match-and-generate",
      (provider) =>
        provider.matchAndGenerate({
          postImage,
          catalogItems,
          catalogProfiles,
          promptContext,
          repeatingText,
        }),
      providerId
    );

    providerId = outcome.providerUsed;
    res.setHeader("X-AI-Provider-Used", outcome.providerUsed);
    res.setHeader("X-AI-Match-Mode", outcome.result.matchMode);
    res.setHeader("X-AI-Attempts", JSON.stringify(outcome.attempts));
    return res.json({ ...outcome.result, providerUsed: outcome.providerUsed });
  } catch (error: unknown) {
    console.error("Error matching post & generating caption:", error);
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
    const { currentCaption, instructions, promptContext, repeatingText } = req.body;
    if (!currentCaption) {
      return res.status(400).json({ error: "Missing caption to refine." });
    }

    const provider = getActiveProvider();
    const caption = await provider.refineCaption({
      currentCaption,
      instructions,
      promptContext,
      repeatingText,
    });
    return res.json({ caption });
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
