import type { NextResponse } from "next/server";
import { refreshCookieMaxAgeMs } from "../services/authService";

export const REFRESH_COOKIE = "aurastudio_refresh";
export const LEGACY_REFRESH_COOKIE = "auragrid_refresh";

export function getRefreshTokenFromCookies(
  cookies: { get: (name: string) => { value?: string } | undefined }
): string | undefined {
  return cookies.get(REFRESH_COOKIE)?.value ?? cookies.get(LEGACY_REFRESH_COOKIE)?.value;
}

export function setRefreshCookie(res: NextResponse, token: string): void {
  res.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(refreshCookieMaxAgeMs() / 1000),
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
