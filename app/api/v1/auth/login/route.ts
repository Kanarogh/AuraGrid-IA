import { NextResponse, type NextRequest } from "next/server";
import { accessTokenMaxAgeMs, loginUser } from "@/server/services/authService";
import { setRefreshCookie } from "@/server/http/cookies";
import { errorResponse } from "@/server/http/respond";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
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
    return errorResponse(err, 401);
  }
}
