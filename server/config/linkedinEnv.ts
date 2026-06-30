import { envString } from "./env";

export const LINKEDIN_CLIENT_ID = envString("LINKEDIN_CLIENT_ID");
export const LINKEDIN_CLIENT_SECRET = envString("LINKEDIN_CLIENT_SECRET");
export const LINKEDIN_OAUTH_REDIRECT_URI = envString("LINKEDIN_OAUTH_REDIRECT_URI");

export function isLinkedInOAuthConfigured(): boolean {
  return !!(LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET && LINKEDIN_OAUTH_REDIRECT_URI);
}
