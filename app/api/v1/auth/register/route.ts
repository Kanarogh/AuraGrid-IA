import { NextResponse, type NextRequest } from "next/server";
import { ALLOW_PUBLIC_REGISTER } from "@/server/config/env";
import { accessTokenMaxAgeMs, registerUser } from "@/server/services/authService";
import { assertAuthRateLimit, authRateLimitHeaders } from "@/server/http/authRateLimit";
import { setRefreshCookie } from "@/server/http/cookies";
import { errorResponse, HttpError } from "@/server/http/respond";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!ALLOW_PUBLIC_REGISTER) {
      return NextResponse.json(
        { error: "Cadastro público desabilitado. Solicite acesso ao administrador." },
        { status: 403 }
      );
    }
    assertAuthRateLimit(req, "register", 5);
    const { email, password, displayName } = (await req.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
    };
    if (!email?.trim() || !password || password.length < 8) {
      return NextResponse.json(
        { error: "E-mail e senha (mín. 8 caracteres) são obrigatórios." },
        { status: 400 }
      );
    }
    const { user, tokens } = await registerUser({
      email,
      password,
      displayName: displayName ?? email.split("@")[0] ?? "Usuário",
    });
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
    return errorResponse(err, 400);
  }
}
