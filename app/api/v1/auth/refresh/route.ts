import { NextResponse, type NextRequest } from "next/server";
import { accessTokenMaxAgeMs, refreshSession } from "@/server/services/authService";
import { REFRESH_COOKIE, setRefreshCookie } from "@/server/http/cookies";
import { errorResponse } from "@/server/http/respond";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(REFRESH_COOKIE)?.value;
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
    return errorResponse(err, 401);
  }
}
