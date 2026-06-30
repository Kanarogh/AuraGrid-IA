import { NextResponse, type NextRequest } from "next/server";
import { accessTokenMaxAgeMs, refreshSession } from "@/server/services/authService";
import { assertAuthRateLimit, authRateLimitHeaders } from "@/server/http/authRateLimit";
import { getRefreshTokenFromCookies, setRefreshCookie } from "@/server/http/cookies";
import { errorResponse, HttpError } from "@/server/http/respond";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertAuthRateLimit(req, "refresh", 30);
    const token = getRefreshTokenFromCookies(req.cookies);
    if (!token) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    const { user, tokens } = await refreshSession(token);
    const res = NextResponse.json({
      user,
      accessToken: tokens.accessToken,
      expiresIn: accessTokenMaxAgeMs(),
    });
    setRefreshCookie(res, tokens.refreshToken);
    return res;
  } catch (err) {
    if (err instanceof HttpError && err.status === 429) {
      const retryAfterSec = /Aguarde (\d+)s/.exec(err.message)?.[1];
      const headers = retryAfterSec ? authRateLimitHeaders(Number(retryAfterSec)) : undefined;
      return NextResponse.json({ error: err.message }, { status: 429, headers });
    }
    return errorResponse(err, 401);
  }
}
