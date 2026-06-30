import { NextResponse, type NextRequest } from "next/server";
import { revokeRefreshToken } from "@/server/services/authService";
import { clearRefreshCookie, getRefreshTokenFromCookies } from "@/server/http/cookies";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = getRefreshTokenFromCookies(req.cookies);
  if (token) await revokeRefreshToken(token).catch(() => undefined);
  const res = NextResponse.json({ ok: true });
  clearRefreshCookie(res);
  return res;
}
