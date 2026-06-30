import { apiFetch } from "./api/apiClient";
import { getState } from "./aiSettingsStore";

export function withAiHeaders(init?: RequestInit): RequestInit {
  const { settings } = getState();
  const headers = new Headers(init?.headers);

  if (settings?.activeProvider) {
    headers.set("X-AI-Provider", settings.activeProvider);
  }

  return { ...init, headers };
}

export function aiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return apiFetch(String(input), withAiHeaders(init));
}
