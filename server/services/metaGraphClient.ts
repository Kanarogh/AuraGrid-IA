import { metaGraphBaseUrl } from "../config/metaEnv";

type GraphError = { message?: string; type?: string; code?: number };

async function graphFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const url = path.startsWith("http") ? path : `${metaGraphBaseUrl()}${path}`;
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}access_token=${encodeURIComponent(accessToken)}`, init);
  const data = (await res.json()) as T & { error?: GraphError };
  if (!res.ok || data.error) {
    const msg = data.error?.message ?? `Meta API ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in?: number;
}> {
  const { META_APP_ID, META_APP_SECRET } = await import("../config/metaEnv");
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${metaGraphBaseUrl()}/oauth/access_token?${params}`);
  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: GraphError;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? "Falha ao trocar código OAuth.");
  }
  return {
    access_token: data.access_token,
    token_type: data.token_type ?? "bearer",
    expires_in: data.expires_in,
  };
}

export async function exchangeForLongLivedToken(shortToken: string): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  const { META_APP_ID, META_APP_SECRET } = await import("../config/metaEnv");
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${metaGraphBaseUrl()}/oauth/access_token?${params}`);
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: GraphError;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? "Falha ao obter token long-lived.");
  }
  return { access_token: data.access_token, expires_in: data.expires_in };
}

export async function getUserPages(accessToken: string): Promise<
  Array<{ id: string; name: string; access_token?: string }>
> {
  const data = await graphFetch<{ data: Array<{ id: string; name: string; access_token?: string }> }>(
    "/me/accounts?fields=id,name,access_token",
    accessToken
  );
  return data.data ?? [];
}

export async function getInstagramBusinessAccount(
  pageId: string,
  pageAccessToken: string
): Promise<{ id: string; username?: string } | null> {
  const data = await graphFetch<{
    instagram_business_account?: { id: string; username?: string };
  }>(`/${pageId}?fields=instagram_business_account{id,username}`, pageAccessToken);
  return data.instagram_business_account ?? null;
}

export async function createMediaContainer(input: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<string> {
  const params = new URLSearchParams({
    image_url: input.imageUrl,
    caption: input.caption,
  });
  const data = await graphFetch<{ id: string }>(
    `/${input.igUserId}/media`,
    input.accessToken,
    { method: "POST", body: params }
  );
  if (!data.id) throw new Error("Meta não retornou ID do container.");
  return data.id;
}

export async function getContainerStatus(
  containerId: string,
  accessToken: string
): Promise<string> {
  const data = await graphFetch<{ status_code?: string }>(
    `/${containerId}?fields=status_code`,
    accessToken
  );
  return data.status_code ?? "UNKNOWN";
}

export async function publishMediaContainer(input: {
  igUserId: string;
  accessToken: string;
  containerId: string;
}): Promise<{ id: string; permalink?: string }> {
  const params = new URLSearchParams({ creation_id: input.containerId });
  const data = await graphFetch<{ id: string }>(
    `/${input.igUserId}/media_publish`,
    input.accessToken,
    { method: "POST", body: params }
  );
  if (!data.id) throw new Error("Meta não retornou ID da mídia publicada.");
  let permalink: string | undefined;
  try {
    const media = await graphFetch<{ permalink?: string }>(
      `/${data.id}?fields=permalink`,
      input.accessToken
    );
    permalink = media.permalink;
  } catch {
    /* opcional */
  }
  return { id: data.id, permalink };
}

export function translateMetaError(message: string): string {
  const lower = message.toLowerCase();
  if (/expired|session|oauth|190/.test(lower)) {
    return "Sua conexão com as redes sociais expirou. Clique em Reconectar.";
  }
  if (/permission|scope|200|10/.test(lower)) {
    return "Sem permissão para publicar. Verifique se a conta é Profissional e reconecte.";
  }
  if (/rate|limit|429|100/.test(lower)) {
    return "Limite de publicações da rede social atingido. Tente mais tarde.";
  }
  if (/image|url|media|download/.test(lower)) {
    return "A rede social não conseguiu baixar a imagem. Tente novamente em alguns minutos.";
  }
  if (/caption|text|length/.test(lower)) {
    return "Legenda inválida ou longa demais para a rede social.";
  }
  return message.length > 120 ? `${message.slice(0, 117)}…` : message;
}
