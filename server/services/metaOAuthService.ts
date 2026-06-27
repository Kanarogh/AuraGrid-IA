import {
  META_APP_ID,
  META_GRAPH_VERSION,
  META_OAUTH_REDIRECT_URI,
  isMetaOAuthConfigured,
} from "../config/metaEnv";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getInstagramBusinessAccount,
  getUserPages,
} from "./metaGraphClient";
import { upsertMetaConnection } from "./metaConnectionService";
import { createOAuthState, parseOAuthState } from "./mediaPublishUrl";

export function buildMetaOAuthStartUrl(clientId: string, userId: string): string {
  if (!isMetaOAuthConfigured()) {
    throw new Error("Meta OAuth não configurado (META_APP_ID, META_APP_SECRET, META_OAUTH_REDIRECT_URI).");
  }
  const state = createOAuthState(clientId, userId);
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_read_engagement",
    "pages_show_list",
  ].join(",");
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_OAUTH_REDIRECT_URI,
    scope: scopes,
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params}`;
}

export async function completeMetaOAuthCallback(
  code: string,
  state: string
): Promise<{ clientId: string; connection: Awaited<ReturnType<typeof upsertMetaConnection>> }> {
  const { clientId, userId } = parseOAuthState(state);
  const short = await exchangeCodeForToken(code, META_OAUTH_REDIRECT_URI);
  const long = await exchangeForLongLivedToken(short.access_token);
  const userToken = long.access_token;

  const pages = await getUserPages(userToken);
  if (!pages.length) {
    throw new Error("Nenhuma Página do Facebook encontrada. Vincule uma Página à conta Instagram.");
  }

  let selectedPage = pages[0];
  let igAccount: { id: string; username?: string } | null = null;

  for (const page of pages) {
    const pageToken = page.access_token ?? userToken;
    const ig = await getInstagramBusinessAccount(page.id, pageToken);
    if (ig) {
      selectedPage = page;
      igAccount = ig;
      break;
    }
  }

  if (!igAccount) {
    throw new Error(
      "Nenhuma conta Instagram Profissional vinculada às suas Páginas. Converta para Business/Creator e vincule uma Página."
    );
  }

  const pageToken = selectedPage.access_token ?? userToken;
  const expiresAt =
    long.expires_in != null ? new Date(Date.now() + long.expires_in * 1000) : null;

  const connection = await upsertMetaConnection({
    clientId,
    userId,
    igUserId: igAccount.id,
    igUsername: igAccount.username ?? null,
    facebookPageId: selectedPage.id,
    pageName: selectedPage.name,
    accessToken: pageToken,
    tokenExpiresAt: expiresAt,
    scopes: "instagram_basic,instagram_content_publish",
  });

  return { clientId, connection };
}
