import { envString } from "./env";

export const META_APP_ID = envString("META_APP_ID");
export const META_APP_SECRET = envString("META_APP_SECRET");
export const META_OAUTH_REDIRECT_URI = envString("META_OAUTH_REDIRECT_URI");
export const META_GRAPH_VERSION = envString("META_GRAPH_VERSION", "v21.0");
export const META_TOKEN_ENCRYPTION_KEY = envString("META_TOKEN_ENCRYPTION_KEY");
export const META_PUBLISH_MOCK = envString("META_PUBLISH_MOCK", "0") === "1";
export const NEXT_PUBLIC_APP_URL = envString(
  "NEXT_PUBLIC_APP_URL",
  envString("VERCEL_URL") ? `https://${envString("VERCEL_URL")}` : "http://localhost:3000"
);

export function isMetaOAuthConfigured(): boolean {
  return !!(META_APP_ID && META_APP_SECRET && META_OAUTH_REDIRECT_URI);
}

export function metaGraphBaseUrl(): string {
  return `https://graph.facebook.com/${META_GRAPH_VERSION}`;
}
