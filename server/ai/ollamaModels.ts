import { getOllamaBaseUrl, isOllamaConfigured } from "./config";

export type OllamaModelOption = {
  /** Nome exato no Ollama (ex.: gemma4:latest). */
  id: string;
  label: string;
  description: string;
  vision: boolean;
  sizeBytes?: number;
};

/** Remove sufixo :latest para comparar com OLLAMA_MODEL no .env. */
export function normalizeOllamaModelId(id: string): string {
  return id.trim().replace(/:latest$/i, "");
}

export function sanitizeOllamaModelId(raw: string): string | null {
  const t = raw.trim();
  if (!t || t.length > 120) return null;
  if (!/^[a-zA-Z0-9._:+-]+$/.test(t)) return null;
  if (t.includes(":cloud")) return null;
  return t;
}

/** Modelos *:cloud e remotos ficam de fora — só o que está no disco local. */
export function isLocalOllamaModel(name: string): boolean {
  const n = name.toLowerCase();
  return !n.includes(":cloud") && !n.endsWith("-cloud");
}

/** Heurística: modelos com visão úteis para match/legenda com foto. */
export function isLikelyOllamaVisionModel(name: string): boolean {
  const n = name.toLowerCase();
  if (/gemma|llava|moondream|bakllava|minicpm-v|granite.*vision|phi.*vision|llama4|llama-4|llama3\.2.*vision|scout.*vision/.test(n)) {
    return true;
  }
  if (/qwen2\.5vl|qwen-vl|qwen3-vl|qwen3\.5/.test(n)) return true;
  if (/qwen3\.6(?!.*vl)|qwen3:(?!.*vl)|deepseek-r1(?!.*vl)|mistral|codellama/.test(n)) {
    return false;
  }
  return /vl|vision/.test(n);
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

function labelForModel(name: string, vision: boolean, sizeBytes?: number): string {
  const base = name.replace(/:latest$/i, "");
  const size = formatSize(sizeBytes);
  const tag = vision ? "visão" : "só texto";
  return size ? `${base} (${size}, ${tag})` : `${base} (${tag})`;
}

function descriptionForModel(name: string, vision: boolean): string {
  if (vision) {
    return "Instalado localmente — serve para match, legenda e indexação com foto.";
  }
  return "Instalado localmente — sem visão; não use para match/legenda com foto.";
}

export async function listLocalOllamaModels(): Promise<{
  models: OllamaModelOption[];
  reachable: boolean;
  fetchedAt: string;
}> {
  const fetchedAt = new Date().toISOString();
  if (!isOllamaConfigured()) {
    return { models: [], reachable: false, fetchedAt };
  }

  const baseUrl = getOllamaBaseUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { models: [], reachable: false, fetchedAt };

    const data = (await res.json()) as {
      models?: { name: string; size?: number; details?: { parameter_size?: string } }[];
    };

    const models = (data.models ?? [])
      .filter((m) => typeof m.name === "string" && isLocalOllamaModel(m.name))
      .map((m) => {
        const vision = isLikelyOllamaVisionModel(m.name);
        return {
          id: m.name,
          label: labelForModel(m.name, vision, m.size),
          description: descriptionForModel(m.name, vision),
          vision,
          sizeBytes: m.size,
        };
      })
      .sort((a, b) => {
        if (a.vision !== b.vision) return a.vision ? -1 : 1;
        return a.id.localeCompare(b.id);
      });

    return { models, reachable: true, fetchedAt };
  } catch {
    return { models: [], reachable: false, fetchedAt };
  }
}

export function resolveActiveOllamaModel(
  installed: OllamaModelOption[],
  runtime: string | null,
  envModel: string
): string {
  const candidates = [runtime, envModel].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const norm = normalizeOllamaModelId(candidate);
    const hit = installed.find(
      (m) =>
        m.id === candidate ||
        normalizeOllamaModelId(m.id) === norm ||
        m.id.startsWith(`${norm}:`)
    );
    if (hit) return hit.id;
  }
  const firstVision = installed.find((m) => m.vision);
  if (firstVision) return firstVision.id;
  return envModel;
}
