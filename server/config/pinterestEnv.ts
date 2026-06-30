import { envString } from "./env";

export const PINTEREST_APP_ID = envString("PINTEREST_APP_ID");
export const PINTEREST_APP_SECRET = envString("PINTEREST_APP_SECRET");
export const PINTEREST_OAUTH_REDIRECT_URI = envString("PINTEREST_OAUTH_REDIRECT_URI");

export function isPinterestOAuthConfigured(): boolean {
  return !!(PINTEREST_APP_ID && PINTEREST_APP_SECRET && PINTEREST_OAUTH_REDIRECT_URI);
}

export function pinterestApiBaseUrl(): string {
  return "https://api.pinterest.com/v5";
}
