import { isQuotaExhausted, parseRetrySeconds } from "./shared.ts";
import type { AiProviderId } from "./types.ts";

export type AiFailureKind =
  | "quota_exhausted"
  | "rate_limit"
  | "empty_response"
  | "model_unavailable"
  | "timeout"
  | "auth"
  | "cooldown"
  | "not_configured"
  | "other";

export type AiDiagnosticEvent = {
  at: string;
  operation: string;
  provider: AiProviderId | "system";
  model?: string;
  phase: "chain" | "start" | "ok" | "fail" | "skip";
  failureKind?: AiFailureKind;
  httpStatus?: number;
  routedModel?: string;
  finishReason?: string;
  retryAfterSec?: number | null;
  message: string;
  detail?: string;
};

const MAX_EVENTS = 80;
const events: AiDiagnosticEvent[] = [];

function isDebugVerbose(): boolean {
  const v = process.env.AI_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function classifyAiFailure(error: unknown): AiFailureKind {
  const msg = error instanceof Error ? error.message : String(error);

  if (/cooldown/i.test(msg)) return "cooldown";
  if (/not_configured|não configurad/i.test(msg)) return "not_configured";
  if (isQuotaExhausted(error) || /limit:\s*0\b/i.test(msg)) return "quota_exhausted";
  if (/resposta vazia|empty response/i.test(msg)) return "empty_response";
  if (/no endpoints found|indisponível no OpenRouter|provider returned error/i.test(msg)) {
    return "model_unavailable";
  }
  if (/504|timeout|timed out|ETIMEDOUT|aborted/i.test(msg)) return "timeout";
  if (/401|403|invalid.*key|unauthorized/i.test(msg)) return "auth";
  if (/429|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) return "rate_limit";

  return "other";
}

export function failureKindLabel(kind: AiFailureKind): string {
  switch (kind) {
    case "quota_exhausted":
      return "cota esgotada (limite diário/0)";
    case "rate_limit":
      return "rate limit (pode voltar em minutos)";
    case "empty_response":
      return "resposta vazia do modelo (não é cota)";
    case "model_unavailable":
      return "modelo indisponível no provedor";
    case "timeout":
      return "timeout / 504";
    case "auth":
      return "chave inválida ou sem permissão";
    case "cooldown":
      return "provedor em cooldown após falhas";
    case "not_configured":
      return "sem chave no .env";
    default:
      return "outro erro";
  }
}

function pushEvent(event: Omit<AiDiagnosticEvent, "at">) {
  const full: AiDiagnosticEvent = { at: new Date().toISOString(), ...event };
  events.push(full);
  if (events.length > MAX_EVENTS) events.shift();

  const prefix = `[IA:${event.operation}]`;
  const providerTag =
    event.provider === "system" ? "" : ` ${event.provider}${event.model ? `/${event.model}` : ""}`;

  if (event.phase === "ok") {
    console.info(`${prefix} OK${providerTag} — ${event.message}`);
    return;
  }

  if (event.phase === "chain") {
    console.info(`${prefix} ${event.message}`);
    return;
  }

  if (event.phase === "skip") {
    console.info(`${prefix} SKIP${providerTag} — ${event.message}`);
    return;
  }

  if (event.phase === "start") {
    console.info(`${prefix} …${providerTag} — ${event.message}`);
    return;
  }

  const kind = event.failureKind ? ` [${failureKindLabel(event.failureKind)}]` : "";
  const retry =
    event.retryAfterSec != null && event.retryAfterSec > 0
      ? ` retry≈${event.retryAfterSec}s`
      : "";
  console.warn(`${prefix} FALHA${providerTag}${kind}${retry} — ${event.message}`);

  if (isDebugVerbose() && event.detail) {
    console.warn(`${prefix} detalhe:`, event.detail.slice(0, 1200));
  }
}

export function logAiChain(operation: string, active: AiProviderId, chain: AiProviderId[]) {
  pushEvent({
    operation,
    provider: "system",
    phase: "chain",
    message: `ativo=${active} | tentativas: ${chain.length ? chain.join(" → ") : "(nenhuma)"}`,
  });
}

export function logAiAttemptStart(
  operation: string,
  provider: AiProviderId,
  model?: string
) {
  pushEvent({
    operation,
    provider,
    model,
    phase: "start",
    message: "chamando API…",
  });
}

export function logAiAttemptOk(
  operation: string,
  provider: AiProviderId,
  model?: string,
  extra?: string
) {
  pushEvent({
    operation,
    provider,
    model,
    phase: "ok",
    message: extra ?? "sucesso",
  });
}

export function logAiAttemptFail(
  operation: string,
  provider: AiProviderId,
  error: unknown,
  opts?: {
    model?: string;
    httpStatus?: number;
    routedModel?: string;
    finishReason?: string;
    detail?: string;
  }
) {
  const failureKind = classifyAiFailure(error);
  const msg = error instanceof Error ? error.message : String(error);
  const retryAfterSec = parseRetrySeconds(error);

  let summary = msg;
  if (msg.length > 220) summary = `${msg.slice(0, 217)}…`;

  if (failureKind === "quota_exhausted") {
    summary = `Cota esgotada confirmada — ${summary}`;
  } else if (failureKind === "empty_response") {
    summary = `Modelo respondeu HTTP 200 mas sem texto útil — ${summary}`;
  } else if (failureKind === "rate_limit" && retryAfterSec) {
    summary = `Rate limit — aguarde ~${retryAfterSec}s — ${summary}`;
  }

  pushEvent({
    operation,
    provider,
    model: opts?.model,
    phase: "fail",
    failureKind,
    httpStatus: opts?.httpStatus,
    routedModel: opts?.routedModel,
    finishReason: opts?.finishReason,
    retryAfterSec,
    message: summary,
    detail: opts?.detail,
  });
}

export function logAiSkip(
  operation: string,
  provider: AiProviderId,
  reason: string
) {
  const failureKind: AiFailureKind =
    reason === "cooldown"
      ? "cooldown"
      : reason === "not_configured"
        ? "not_configured"
        : "other";
  pushEvent({
    operation,
    provider,
    phase: "skip",
    failureKind,
    message: reason,
  });
}

export function getAiDiagnosticsSnapshot(limit = 40) {
  return {
    debugVerbose: isDebugVerbose(),
    hint: "Defina AI_DEBUG=1 no .env e reinicie para ver detalhes completos no terminal.",
    events: events.slice(-limit),
  };
}

export function summarizeFailuresForUser(
  attempts: Array<{ provider: AiProviderId; error?: string; skipped?: string }>
): string {
  const lines: string[] = [];
  for (const a of attempts) {
    if (a.skipped) {
      lines.push(`• ${a.provider}: ignorado (${a.skipped})`);
      continue;
    }
    if (!a.error) continue;
    const kind = classifyAiFailure(new Error(a.error));
    lines.push(`• ${a.provider}: ${failureKindLabel(kind)}`);
  }
  return lines.length ? lines.join("\n") : "Nenhuma tentativa registrada.";
}
