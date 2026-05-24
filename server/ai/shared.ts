import { classifyAiFailure, failureKindLabel } from "./diagnostics.ts";
import type { AiProviderId } from "./types.ts";

export function cleanBase64(base64Str: string) {
  if (!base64Str) return { mimeType: "image/png", data: "" };
  const parts = base64Str.split(";base64,");
  if (parts.length > 1) {
    const mimeType = parts[0].replace("data:", "");
    const data = parts[1];
    return { mimeType, data };
  }
  return { mimeType: "image/png", data: base64Str };
}

export function toDataUrl(base64Str: string): string {
  if (base64Str.startsWith("data:")) return base64Str;
  const { mimeType, data } = cleanBase64(base64Str);
  return `data:${mimeType};base64,${data}`;
}

export function parseRetrySeconds(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error);

  const headerMatch = msg.match(/retry-?after:\s*(\d+(?:\.\d+)?)/i);
  if (headerMatch) return Math.ceil(parseFloat(headerMatch[1])) + 1;

  const m =
    msg.match(/retry in (\d+(?:\.\d+)?)s/i) ||
    msg.match(/try again in (\d+(?:\.\d+)?)s/i) ||
    msg.match(/retry after (\d+(?:\.\d+)?)s/i);
  if (m) return Math.ceil(parseFloat(m[1])) + 1;

  const ms = msg.match(/retry in (\d+)ms/i);
  if (ms) return Math.max(1, Math.ceil(parseFloat(ms[1]) / 1000));

  return null;
}

/** Anexa o header Retry-After (quando presente) à mensagem do erro para o retry conseguir parsear. */
export function annotateErrorWithRetryAfter(err: Error, response: Response): Error {
  const ra = response.headers.get("retry-after");
  if (!ra) return err;

  const seconds = /^\d+(\.\d+)?$/.test(ra)
    ? parseFloat(ra)
    : (() => {
        const date = new Date(ra).getTime();
        if (!Number.isFinite(date)) return null;
        return Math.max(0, Math.round((date - Date.now()) / 1000));
      })();

  if (seconds === null || !Number.isFinite(seconds)) return err;

  if (!/retry/i.test(err.message)) {
    err.message = `${err.message} (retry-after: ${seconds}s)`;
  }
  return err;
}

export function isQuotaExhausted(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /limit:\s*0\b/i.test(msg) ||
    /RESOURCE_EXHAUSTED/i.test(msg) ||
    /quota exceeded/i.test(msg) ||
    /insufficient_quota/i.test(msg)
  );
}

export function shouldRetryAiError(error: unknown): boolean {
  if (isQuotaExhausted(error)) return false;
  const msg = error instanceof Error ? error.message : String(error);
  if (/429|rate.?limit/i.test(msg)) return true;
  return parseRetrySeconds(error) !== null;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  gemini: "Gemini",
  groq: "Groq",
  deepseek: "DeepSeek",
  openrouter: "OpenRouter",
};

const PROVIDER_KEY_ENV: Record<AiProviderId, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const PROVIDER_MODEL_ENV: Record<AiProviderId, string> = {
  gemini: "GEMINI_MODEL",
  groq: "GROQ_MODEL",
  deepseek: "DEEPSEEK_MODEL",
  openrouter: "OPENROUTER_MODEL",
};

export function formatAiError(error: unknown, provider: AiProviderId): string {
  const raw = error instanceof Error ? error.message : String(error);
  const label = PROVIDER_LABELS[provider];
  const kind = classifyAiFailure(error);

  if (kind === "empty_response") {
    return raw.includes("Não é cota")
      ? raw
      : `${label}: o modelo respondeu sem texto (não é cota). No painel IA, use OpenRouter + "Qwen 2.5 VL 32B (free)".`;
  }

  if (kind === "model_unavailable") {
    return `Modelo indisponível no ${label}. Escolha outro no painel IA (ex.: Qwen VL 32B ou OpenRouter Free).`;
  }

  if (kind === "quota_exhausted" || kind === "rate_limit") {
    const hint =
      kind === "quota_exhausted"
        ? "Cota esgotada"
        : `Rate limit (${failureKindLabel(kind)})`;
    return `${hint} — API ${label}. Aguarde o reset ou troque o provedor no painel IA (✨). Detalhe: ${raw.slice(0, 160)}…`;
  }

  if (/404|not found/i.test(raw) && /model/i.test(raw)) {
    return `Modelo inválido. Ajuste ${PROVIDER_MODEL_ENV[provider]} no .env.`;
  }

  if (/no endpoints found/i.test(raw)) {
    return `Modelo OpenRouter indisponível. No painel IA (topo), escolha "OpenRouter Free (auto)" ou "Qwen 2.5 VL 32B (free)" e tente de novo.`;
  }

  if (/image_url|unknown variant.*expected.*text/i.test(raw)) {
    return provider === "deepseek"
      ? "DeepSeek não analisa imagens. Configure GROQ_API_KEY ou GEMINI_API_KEY no .env (reinicie o servidor) e tente de novo."
      : `Este provedor não aceita imagens no formato enviado. Detalhe: ${raw.slice(0, 120)}…`;
  }

  if (raw.length > 280) return `${raw.slice(0, 280)}…`;
  return raw || `Falha na chamada à API ${label}.`;
}

/** Acima desse limite vale a pena cair pro próximo provedor em vez de esperar. */
const MAX_RETRY_WAIT_SEC = 25;

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!shouldRetryAiError(err) || attempt >= maxAttempts) throw err;
      const requested = parseRetrySeconds(err) ?? 15;
      if (requested > MAX_RETRY_WAIT_SEC) {
        console.warn(
          `${label} pediu retry em ${requested}s (> ${MAX_RETRY_WAIT_SEC}s) — abortando para dar fallback.`
        );
        throw err;
      }
      const waitSec = Math.min(requested, MAX_RETRY_WAIT_SEC);
      console.warn(`${label} rate limit — retry in ${waitSec}s (attempt ${attempt})`);
      await sleep(waitSec * 1000);
    }
  }
  throw lastError;
}
