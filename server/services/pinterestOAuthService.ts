import {
  PINTEREST_APP_ID,
  PINTEREST_OAUTH_REDIRECT_URI,
  isPinterestOAuthConfigured,
} from "../config/pinterestEnv";
import { createOAuthState, parseOAuthState } from "./mediaPublishUrl";
import {
  exchangePinterestCode,
  getPinterestUser,
  listPinterestBoards,
} from "./pinterestGraphClient";
import { assertClientAccessResolved } from "./permissionService";
import { META_CONNECT } from "../http/publishAccess";
import { upsertSocialConnection } from "./socialConnectionService";
import type { AuthUser } from "./authService";

export function buildPinterestOAuthStartUrl(clientId: string, userId: string): string {
  if (!isPinterestOAuthConfigured()) {
    throw new Error(
      "Pinterest OAuth não configurado (PINTEREST_APP_ID, PINTEREST_APP_SECRET, PINTEREST_OAUTH_REDIRECT_URI)."
    );
  }
  const state = createOAuthState(clientId, userId);
  const scopes = ["boards:read", "boards:write", "pins:read", "pins:write", "user_accounts:read"].join(
    ","
  );
  const params = new URLSearchParams({
    response_type: "code",
    client_id: PINTEREST_APP_ID,
    redirect_uri: PINTEREST_OAUTH_REDIRECT_URI,
    state,
    scope: scopes,
  });
  return `https://www.pinterest.com/oauth/?${params}`;
}

export async function completePinterestOAuthCallback(
  code: string,
  state: string
): Promise<{ clientId: string; boards: Array<{ id: string; name: string }> }> {
  const { clientId, userId } = parseOAuthState(state);
  const authUser: AuthUser = { id: userId, email: "", displayName: "" };
  await assertClientAccessResolved(authUser, clientId, META_CONNECT);

  const tokens = await exchangePinterestCode(code);
  const user = await getPinterestUser(tokens.access_token);
  const boards = await listPinterestBoards(tokens.access_token);
  const defaultBoard = boards[0];

  await upsertSocialConnection({
    clientId,
    userId,
    platform: "pinterest",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    metadata: {
      username: user.username,
      displayName: user.username,
      defaultBoardId: defaultBoard?.id ?? null,
      defaultBoardName: defaultBoard?.name ?? null,
      boards: boards.slice(0, 20),
    },
  });

  return { clientId, boards };
}
