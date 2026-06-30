import {
  PINTEREST_APP_ID,
  PINTEREST_APP_SECRET,
  PINTEREST_OAUTH_REDIRECT_URI,
  pinterestApiBaseUrl,
} from "../config/pinterestEnv";

async function pinterestFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const url = path.startsWith("http") ? path : `${pinterestApiBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? `Pinterest API ${res.status}`);
  }
  return data;
}

export async function exchangePinterestCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(`${PINTEREST_APP_ID}:${PINTEREST_APP_SECRET}`).toString(
    "base64"
  );
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: PINTEREST_OAUTH_REDIRECT_URI,
  });
  const res = await fetch(`${pinterestApiBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    message?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.message ?? "Falha ao trocar código Pinterest.");
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? "",
    expires_in: data.expires_in ?? 3600,
  };
}

export async function refreshPinterestToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(`${PINTEREST_APP_ID}:${PINTEREST_APP_SECRET}`).toString(
    "base64"
  );
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(`${pinterestApiBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    message?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.message ?? "Falha ao renovar token Pinterest.");
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: data.expires_in ?? 3600,
  };
}

export async function getPinterestUser(accessToken: string): Promise<{
  username: string;
  id: string;
}> {
  const data = await pinterestFetch<{ username: string; id: string }>("/user_account", accessToken);
  return data;
}

export async function listPinterestBoards(accessToken: string): Promise<
  Array<{ id: string; name: string }>
> {
  const data = await pinterestFetch<{ items: Array<{ id: string; name: string }> }>(
    "/boards?page_size=50",
    accessToken
  );
  return data.items ?? [];
}

export async function createPinterestPin(input: {
  accessToken: string;
  boardId: string;
  imageUrl: string;
  title: string;
  description: string;
}): Promise<{ id: string; permalink: string | null }> {
  const data = await pinterestFetch<{ id: string; link?: string }>("/pins", input.accessToken, {
    method: "POST",
    body: JSON.stringify({
      board_id: input.boardId,
      title: input.title.slice(0, 100),
      description: input.description.slice(0, 500),
      media_source: {
        source_type: "image_url",
        url: input.imageUrl,
      },
    }),
  });
  return {
    id: data.id,
    permalink: data.link ?? `https://www.pinterest.com/pin/${data.id}/`,
  };
}

export function translatePinterestError(message: string): string {
  const lower = message.toLowerCase();
  if (/expired|invalid.*token|401|unauthorized/.test(lower)) {
    return "Sua conexão com o Pinterest expirou. Reconecte em Programar posts.";
  }
  if (/permission|403|scope/.test(lower)) {
    return "Sem permissão para publicar no Pinterest. Verifique as permissões do app.";
  }
  if (/rate|limit|429/.test(lower)) {
    return "Limite de publicações do Pinterest atingido. Tente mais tarde.";
  }
  return message.length > 120 ? `${message.slice(0, 117)}…` : message;
}
