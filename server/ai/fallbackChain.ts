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
import { sanitizeForHttpHeader } from "./httpHeaders.ts";
import { isQuotaExhausted } from "./shared.ts";
import type { AiProvider, AiProviderId } from "./types.ts";

export type FallbackOutcome<T> = {
  result: T;
  providerUsed: AiProviderId;
  /** Modelo real (ex.: roteado pelo openrouter/free). */
  modelLabel?: string;
  attempts: Array<{ provider: AiProviderId; error?: string; skipped?: string }>;
};

const AURAGRID_ROUTED_MODEL_KEY = "__auragridRoutedModel";

export function stripAuraGridMeta<T extends Record<string, unknown>>(result: T): {
  profile: T;
  routedModel?: string;
} {
  if (!(AURAGRID_ROUTED_MODEL_KEY in result)) {
    return { profile: result };
  }
  const { [AURAGRID_ROUTED_MODEL_KEY]: routed, ...profile } = result;
  return {
    profile: profile as T,
    routedModel: typeof routed === "string" ? routed : undefined,
  };
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (isQuotaExhausted(err)) return true;
  return /429|RESOURCE_EXHAUSTED|rate.?limit|timeout|timed out|ETIMEDOUT|503|502|insufficient_quota|image_url|unknown variant.*text|DeepSeek não analisa|no endpoints found|resposta vazia|indisponível no OpenRouter|perfil json incompleto|incompletecatalogprofile|todos os modelos de visão falharam/i.test(
    msg
  );
}

/** Cadeia de visão: provedor ativo → pares diretos (Gemini↔Groq) → OpenRouter por último. */
function visionChain(active: AiProviderId): AiProviderId[] {
  if (active === "openrouter") {
    const chain: AiProviderId[] = [];
    if (hasOpenRouterKey()) chain.push("openrouter");
    // Quando free do OpenRouter oscila, APIs diretas ainda podem ter cota.
    if (hasGroqKey() && !chain.includes("groq")) chain.push("groq");
    if (hasGeminiKey() && !chain.includes("gemini")) chain.push("gemini");
    return chain;
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
      `OpenRouter free está instável (muitos modelos «No endpoints found»). ` +
      `Tente Groq/Gemini no painel, aguarde o reset diário, ou créditos em openrouter.ai. ` +
      `Diagnóstico: GET /api/ai/diagnostics | AI_DEBUG=1`
  );
}

const PROVIDER_HINT: Partial<Record<AiProviderId, string>> = {
  gemini: "Gemini",
  groq: "Groq",
  deepseek: "DeepSeek (visão via Gemini/Groq/OpenRouter)",
};
