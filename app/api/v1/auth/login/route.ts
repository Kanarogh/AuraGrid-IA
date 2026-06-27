import { NextResponse, type NextRequest } from "next/server";
import { accessTokenMaxAgeMs, loginUser } from "@/server/services/authService";
import { assertAuthRateLimit, authRateLimitHeaders } from "@/server/http/authRateLimit";
import { setRefreshCookie } from "@/server/http/cookies";
import { errorResponse, HttpError } from "@/server/http/respond";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertAuthRateLimit(req, "login", 10);
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
    }
    const { user, tokens } = await loginUser({ email, password });
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
