import {
  LINKEDIN_CLIENT_ID,
  LINKEDIN_OAUTH_REDIRECT_URI,
  isLinkedInOAuthConfigured,
} from "../config/linkedinEnv";
import {
  exchangeLinkedInCode,
  getLinkedInOrganizations,
  getLinkedInProfile,
} from "./linkedinGraphClient";
import { createOAuthState, parseOAuthState } from "./mediaPublishUrl";
import { assertClientAccessResolved } from "./permissionService";
import { META_CONNECT } from "../http/publishAccess";
import { upsertSocialConnection } from "./socialConnectionService";
import type { AuthUser } from "./authService";

export function buildLinkedInOAuthStartUrl(clientId: string, userId: string): string {
  if (!isLinkedInOAuthConfigured()) {
    throw new Error(
      "LinkedIn OAuth não configurado (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_OAUTH_REDIRECT_URI)."
    );
  }
  const state = createOAuthState(clientId, userId);
  const scopes = ["openid", "profile", "w_member_social", "w_organization_social"].join(" ");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: LINKEDIN_OAUTH_REDIRECT_URI,
    state,
    scope: scopes,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

export async function completeLinkedInOAuthCallback(
  code: string,
  state: string
): Promise<{ clientId: string }> {
  const { clientId, userId } = parseOAuthState(state);
  const authUser: AuthUser = { id: userId, email: "", displayName: "" };
  await assertClientAccessResolved(authUser, clientId, META_CONNECT);

  const tokens = await exchangeLinkedInCode(code);
  const profile = await getLinkedInProfile(tokens.access_token);
  const orgs = await getLinkedInOrganizations(tokens.access_token);

  const organization = orgs[0];
  const authorUrn = organization
    ? `urn:li:organization:${organization.id}`
    : `urn:li:person:${profile.sub}`;

  await upsertSocialConnection({
    clientId,
    userId,
    platform: "linkedin",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    metadata: {
      displayName: organization?.name ?? profile.name ?? profile.sub,
      authorUrn,
      organizationUrn: organization ? authorUrn : null,
      personUrn: organization ? null : authorUrn,
      organizationName: organization?.name ?? null,
    },
  });

  return { clientId };
}
