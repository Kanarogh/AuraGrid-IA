import {
  getAiProviderId,
  hasGeminiKey,
  hasGroqKey,
  hasOpenRouterKey,
} from "./config.ts";
import { getProvider } from "./index.ts";
import {
  isProviderInCooldown,
  recordFailure,
  recordSuccess,
} from "./circuitBreaker.ts";
import {
  classifyAiFailure,
  failureKindLabel,
  logAiAttemptFail,
  logAiAttemptOk,
  logAiAttemptStart,
  logAiChain,
  logAiSkip,
} from "./diagnostics.ts";
import { isQuotaExhausted } from "./shared.ts";
import type { AiProvider, AiProviderId } from "./types.ts";

export type FallbackOutcome<T> = {
  result: T;
  providerUsed: AiProviderId;
  attempts: Array<{ provider: AiProviderId; error?: string; skipped?: string }>;
};

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (isQuotaExhausted(err)) return true;
  return /429|RESOURCE_EXHAUSTED|rate.?limit|timeout|timed out|ETIMEDOUT|503|502|insufficient_quota|image_url|unknown variant.*text|DeepSeek não analisa|no endpoints found|resposta vazia|indisponível no OpenRouter|todos os modelos de visão falharam/i.test(
    msg
  );
}

/** Cadeia de visão: provedor ativo → pares diretos (Gemini↔Groq) → OpenRouter por último. */
function visionChain(active: AiProviderId): AiProviderId[] {
  if (active === "openrouter") {
    return hasOpenRouterKey() ? ["openrouter"] : [];
  }

  const chain: AiProviderId[] = [];

  if (active === "gemini" && hasGeminiKey()) chain.push("gemini");
  else if (active === "groq" && hasGroqKey()) chain.push("groq");
  else if (active === "deepseek") {
    // DeepSeek não vê imagem: Gemini antes de Groq (Groq free esgota TPD rápido).
    if (hasGeminiKey()) chain.push("gemini");
    if (hasGroqKey() && !chain.includes("groq")) chain.push("groq");
  }

  if (active === "gemini" && hasGroqKey() && !chain.includes("groq")) {
    chain.push("groq");
  }
  if (active === "groq" && hasGeminiKey() && !chain.includes("gemini")) {
    chain.push("gemini");
  }

  // Último recurso quando APIs diretas falham (cota / rate limit).
  if (hasOpenRouterKey() && !chain.includes("openrouter")) {
    chain.push("openrouter");
  }

  return chain;
}

export async function runVisionWithFallback<T>(
  label: string,
  call: (provider: AiProvider) => Promise<T>,
  activeOverride?: AiProviderId
): Promise<FallbackOutcome<T>> {
  const active = activeOverride ?? getAiProviderId();
  const chain = visionChain(active);
  if (chain.length === 0) {
    throw new Error(
      `Nenhum provedor com visão configurado para ${label}. ` +
        `Adicione GEMINI_API_KEY, GROQ_API_KEY ou OPENROUTER_API_KEY no .env.`
    );
  }

  logAiChain(label, active, chain);

  const attempts: FallbackOutcome<T>["attempts"] = [];
  let lastError: unknown = null;

  for (const id of chain) {
    if (isProviderInCooldown(id)) {
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

    const model = provider.isConfigured() ? provider.getModel() : undefined;
    logAiAttemptStart(label, id, model);

    try {
      const result = await call(provider);
      recordSuccess(id);
      logAiAttemptOk(label, id, model);
      return { result, providerUsed: id, attempts: [...attempts, { provider: id }] };
    } catch (err) {
      lastError = err;
      recordFailure(id, err);
      logAiAttemptFail(label, id, err, { model });
      const kind = classifyAiFailure(err);
      attempts.push({
        provider: id,
        error: `[${failureKindLabel(kind)}] ${
          err instanceof Error ? err.message : String(err)
        }`,
      });

      if (!isTransientError(err)) {
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
  if (active !== "openrouter") {
    throw new Error(
      `${PROVIDER_HINT[active] ?? active} falhou. Resumo: ${summary}. ` +
        `Troque o provedor no painel IA (✨) — ex.: OpenRouter + Qwen VL 32B. ` +
        `Logs: AI_DEBUG=1 no .env | GET /api/ai/diagnostics`
    );
  }
  throw new Error(
    `Todos os provedores falharam para ${label}. Resumo: ${summary}. ` +
      `Veja GET /api/ai/diagnostics ou AI_DEBUG=1 no terminal.`
  );
}

const PROVIDER_HINT: Partial<Record<AiProviderId, string>> = {
  gemini: "Gemini",
  groq: "Groq",
  deepseek: "DeepSeek (visão via Gemini/Groq/OpenRouter)",
};
