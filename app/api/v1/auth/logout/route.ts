import { NextResponse, type NextRequest } from "next/server";
import { revokeRefreshToken } from "@/server/services/authService";
import { REFRESH_COOKIE, clearRefreshCookie } from "@/server/http/cookies";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  if (token) await revokeRefreshToken(token).catch(() => undefined);
  const res = NextResponse.json({ ok: true });
  clearRefreshCookie(res);
  return res;
}
