/** Parse seguro de JSON retornado pelo Gemini (indexação / match). */

export function isJsonParseError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /JSON inválido/i.test(msg) ||
    /Unterminated string in JSON/i.test(msg) ||
    /Unexpected token/i.test(msg) ||
    /anormalmente grande/i.test(msg) ||
    /excedeu tamanho esperado/i.test(msg)
  );
}

const MAX_INDEXING_JSON_CHARS = 24_000;

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function parseGeminiJsonText<T = Record<string, unknown>>(
  raw: string | undefined | null,
  context: string
): T {
  const text = raw?.trim();
  if (!text) {
    throw new Error(`Gemini retornou resposta vazia (${context}).`);
  }
  if (text.length > MAX_INDEXING_JSON_CHARS) {
    throw new Error(
      `Resposta JSON anormalmente grande (${text.length} chars) em ${context} — modelo provavelmente truncou a saída.`
    );
  }

  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);
  const balanced = extractBalancedJsonObject(text);
  if (balanced && balanced !== text) candidates.push(balanced);

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as T;
      assertCompactJson(parsed, context);
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`JSON inválido em ${context}: ${detail}`);
}

function assertCompactJson(value: unknown, context: string): void {
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_INDEXING_JSON_CHARS) {
    throw new Error(
      `Perfil ${context} excedeu tamanho esperado (${serialized.length} chars).`
    );
  }
}
