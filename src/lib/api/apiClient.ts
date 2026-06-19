const ACCESS_TOKEN_KEY = "auragrid_access_token";

let accessToken: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;

let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    setAccessToken(null);
    return null;
  }
  const data = (await res.json()) as { accessToken?: string };
  if (data.accessToken) {
    setAccessToken(data.accessToken);
    return data.accessToken;
  }
  return null;
}

/** Restaura sessão ao recarregar: access token no localStorage ou refresh cookie. */
export async function restoreSession(): Promise<AuthUser | null> {
  const tryMe = async (token: string): Promise<AuthUser | null> => {
    const res = await fetch("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AuthUser };
    return data.user;
  };

  if (accessToken) {
    const user = await tryMe(accessToken);
    if (user) return user;
  }

  const newToken = await refreshAccessToken();
  if (!newToken) return null;

  const user = await tryMe(newToken);
  if (!user) setAccessToken(null);
  return user;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let res = await fetch(path, { ...init, headers, credentials: "include" });

  const skipRefreshRetry = /\/auth\/(?:login|register|refresh|logout)(?:\/|$|\?)/.test(path);
  if (res.status === 401 && !skipRefreshRetry) {
    if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(path, { ...init, headers, credentials: "include" });
    }
  }

  return res;
}

export async function readApiJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erro HTTP ${res.status}`);
  }
  return data;
}

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export async function loginApi(email: string, password: string) {
  const res = await fetch("/api/v1/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await readApiJson<{ user: AuthUser; accessToken: string }>(res);
  setAccessToken(data.accessToken);
  return data.user;
}

export async function registerApi(email: string, password: string, displayName: string) {
  const res = await fetch("/api/v1/auth/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });
  const data = await readApiJson<{ user: AuthUser; accessToken: string }>(res);
  setAccessToken(data.accessToken);
  return data.user;
}

export async function logoutApi() {
  await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
  setAccessToken(null);
}

export async function fetchMe(): Promise<AuthUser | null> {
  return restoreSession();
}

export type StorageHealth = {
  storage?: { mode?: string; database?: { ok?: boolean; configured?: boolean } };
  deploy?: { offlineStorageAllowed?: boolean };
};

export async function fetchStorageMode(): Promise<"postgresql" | "local"> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) {
      return process.env.NODE_ENV === "production" ? "postgresql" : "local";
    }
    const data = (await res.json()) as StorageHealth;
    if (data.deploy?.offlineStorageAllowed === false) return "postgresql";
    return data.storage?.mode === "postgresql" && data.storage.database?.ok
      ? "postgresql"
      : "local";
  } catch {
    return process.env.NODE_ENV === "production" ? "postgresql" : "local";
  }
}
