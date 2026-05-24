import { getState } from "./aiSettingsStore";

/** Anexa provedor e modelo OpenRouter escolhidos na UI a cada chamada de IA. */
export function withAiHeaders(init?: RequestInit): RequestInit {
  const { settings } = getState();
  const headers = new Headers(init?.headers);

  if (settings?.activeProvider) {
    headers.set("X-AI-Provider", settings.activeProvider);
  }
  if (
    settings?.activeProvider === "openrouter" &&
    settings.openrouter.activeModel
  ) {
    headers.set("X-OpenRouter-Model", settings.openrouter.activeModel);
  }

  return { ...init, headers };
}

export function aiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, withAiHeaders(init));
}
