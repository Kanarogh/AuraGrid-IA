import { NextResponse, type NextRequest } from "next/server";
import { accessTokenMaxAgeMs, registerUser } from "@/server/services/authService";
import { setRefreshCookie } from "@/server/http/cookies";
import { errorResponse } from "@/server/http/respond";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
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
    return errorResponse(err, 400);
  }
}
