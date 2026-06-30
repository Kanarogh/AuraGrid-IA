import {
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET,
  LINKEDIN_OAUTH_REDIRECT_URI,
} from "../config/linkedinEnv";

type LinkedInError = { message?: string; status?: number };

async function linkedInFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const url = path.startsWith("http") ? path : `https://api.linkedin.com${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": "202401",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; status?: number };
  if (!res.ok) {
    const msg = (data as LinkedInError).message ?? `LinkedIn API ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function exchangeLinkedInCode(code: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: LINKEDIN_OAUTH_REDIRECT_URI,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
  });
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? "Falha ao trocar código LinkedIn.");
  }
  return {
    access_token: data.access_token,
    expires_in: data.expires_in ?? 3600,
    refresh_token: data.refresh_token,
  };
}

export async function refreshLinkedInToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET,
  });
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? "Falha ao renovar token LinkedIn.");
  }
  return {
    access_token: data.access_token,
    expires_in: data.expires_in ?? 3600,
    refresh_token: data.refresh_token ?? refreshToken,
  };
}

export async function getLinkedInProfile(accessToken: string): Promise<{
  sub: string;
  name?: string;
}> {
  const data = await linkedInFetch<{ sub: string; name?: string }>(
    "/v2/userinfo",
    accessToken
  );
  return data;
}

export async function getLinkedInOrganizations(accessToken: string): Promise<
  Array<{ id: string; name: string }>
> {
  const data = await linkedInFetch<{
    elements?: Array<{
      organization: string;
      "organization~": { localizedName?: string };
    }>;
  }>(
    "/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
    accessToken
  );
  return (data.elements ?? []).map((el) => ({
    id: el.organization.replace("urn:li:organization:", ""),
    name: el["organization~"]?.localizedName ?? el.organization,
  }));
}

export async function publishLinkedInImagePost(input: {
  accessToken: string;
  authorUrn: string;
  imageUrl: string;
  caption: string;
}): Promise<{ id: string; permalink: string | null }> {
  const register = await linkedInFetch<{
    value: { uploadUrl: string; image: string };
  }>("/rest/images?action=initializeUpload", input.accessToken, {
    method: "POST",
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: input.authorUrn,
      },
    }),
  });

  const imageRes = await fetch(input.imageUrl);
  if (!imageRes.ok) throw new Error("Não foi possível baixar a imagem para o LinkedIn.");
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  const uploadRes = await fetch(register.value.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: imageBuffer,
  });
  if (!uploadRes.ok) throw new Error("Falha ao enviar imagem para o LinkedIn.");

  const post = await linkedInFetch<{ id: string }>("/rest/posts", input.accessToken, {
    method: "POST",
    body: JSON.stringify({
      author: input.authorUrn,
      commentary: input.caption,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED" },
      content: {
        media: {
          id: register.value.image,
        },
      },
      lifecycleState: "PUBLISHED",
    }),
  });

  return {
    id: post.id,
    permalink: post.id ? `https://www.linkedin.com/feed/update/${encodeURIComponent(post.id)}` : null,
  };
}

export function translateLinkedInError(message: string): string {
  const lower = message.toLowerCase();
  if (/expired|invalid.*token|401/.test(lower)) {
    return "Sua conexão com o LinkedIn expirou. Reconecte em Programar posts.";
  }
  if (/permission|403|scope/.test(lower)) {
    return "Sem permissão para publicar no LinkedIn. Verifique as permissões do app e reconecte.";
  }
  if (/rate|limit|429/.test(lower)) {
    return "Limite de publicações do LinkedIn atingido. Tente mais tarde.";
  }
  return message.length > 120 ? `${message.slice(0, 117)}…` : message;
}
