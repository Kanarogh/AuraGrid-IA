import { getAiProviderId, isAiFallbackAllowed } from "./config";
import { getProvider } from "./index";
import {
  isProviderInCooldown,
  recordFailure,
  recordSuccess,
} from "./circuitBreaker";
import {
  classifyAiFailure,
  failureKindLabel,
  logAiAttemptFail,
  logAiAttemptOk,
  logAiAttemptStart,
  logAiChain,
  logAiSkip,
} from "./diagnostics";
import { sanitizeForHttpHeader } from "./httpHeaders";
import type { AiProvider, AiProviderId } from "./types";
import {
  buildVisionProviderChain,
  stripAuraGridMeta,
  shouldTryNextProvider,
  type FallbackOutcome,
} from "./visionChain";

export type { FallbackOutcome } from "./visionChain";
export { stripAuraGridMeta } from "./visionChain";

export async function runVisionWithFallback<T>(
  label: string,
  call: (provider: AiProvider) => Promise<T>,
  activeOverride?: AiProviderId
): Promise<FallbackOutcome<T>> {
  const active = activeOverride ?? getAiProviderId();
  const chain = buildVisionProviderChain(active);
  if (chain.length === 0) {
    throw new Error(
      `Provedor "${active}" não está disponível para ${label}. ` +
        `Configure a chave no .env ou escolha outro provedor no painel (Configurações).`
    );
  }

  logAiChain(label, active, chain);

  const attempts: FallbackOutcome<T>["attempts"] = [];
  let lastError: unknown = null;
  const allowFallback = isAiFallbackAllowed();

  for (const id of chain) {
    const skipCooldown = !allowFallback && id === active;
    if (!skipCooldown && isProviderInCooldown(id)) {
      logAiSkip(label, id, "cooldown");
      attempts.push({ provider: id, skipped: "cooldown" });
      continue;
    }

    const provider = getProvider(id);
    if (!provider.isConfigured()) {
      logAiSkip(label, id, "not_configured");
      attempts.push({ provider: id, skipped: "not_configured" });
      continue;
    }

    const model = provider.getModel();
    logAiAttemptStart(label, id, model);

    try {
      const raw = await call(provider);
      let profile: T = raw;
      let routedModel: string | undefined;
      if (raw && typeof raw === "object") {
        const stripped = stripAuraGridMeta(raw as Record<string, unknown>);
        profile = stripped.profile as T;
        routedModel = stripped.routedModel;
      }
      const modelLabel = routedModel ?? model;
      recordSuccess(id);
      logAiAttemptOk(label, id, modelLabel);
      return {
        result: profile,
        providerUsed: id,
        modelLabel,
        attempts: [...attempts, { provider: id }],
      };
    } catch (err) {
      lastError = err;
      recordFailure(id, err);
      logAiAttemptFail(label, id, err, { model });
      const kind = classifyAiFailure(err);
      attempts.push({
        provider: id,
        error: sanitizeForHttpHeader(
          `[${failureKindLabel(kind)}] ${err instanceof Error ? err.message : String(err)}`,
          240
        ),
      });

      if (!allowFallback) {
        const hint =
          id === "openrouter"
            ? " Escolha outro modelo OpenRouter no painel ou use Ollama local."
            : id === "ollama"
              ? " Confira se o Ollama está aberto e se OLLAMA_MODEL no .env bate com um modelo com visão (ex.: gemma4)."
              : "";
        const base = err instanceof Error ? err : new Error(String(err));
        throw new Error(`${base.message}${hint}`);
      }

      if (!shouldTryNextProvider(err)) {
        throw err;
      }
    }
  }

  const summary = attempts
    .map((a) =>
      a.skipped
        ? `${a.provider}(skip:${a.skipped})`
        : `${a.provider}: ${a.error?.split("]")[0]?.replace("[", "") ?? "?"}`
    )
    .join("; ");

  if (lastError) {
    const err = lastError instanceof Error ? lastError : new Error(String(lastError));
    err.message = `${err.message}\n\nResumo das tentativas: ${summary || "nenhuma"}`;
    throw err;
  }

  throw new Error(
    `Falha em ${label} (${active}). Resumo: ${summary || "nenhuma tentativa"}. ` +
      `Provedor escolhido: ${active}. Logs: AI_DEBUG=1 | GET /api/ai/diagnostics`
  );
}
