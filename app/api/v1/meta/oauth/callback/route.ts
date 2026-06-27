import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/server/http/respond";
import { completeMetaOAuthCallback } from "@/server/services/metaOAuthService";
import { NEXT_PUBLIC_APP_URL } from "@/server/config/metaEnv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error_description") ?? req.nextUrl.searchParams.get("error");
    const base = NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

    if (error || !code || !state) {
      const msg = encodeURIComponent(error ?? "Autorização cancelada.");
      return NextResponse.redirect(`${base}/welcome?meta_error=${msg}`);
    }

    const { clientId } = await completeMetaOAuthCallback(code, state);
    return NextResponse.redirect(
      `${base}/c/${encodeURIComponent(clientId)}/programar-posts?meta_connected=1`
    );
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "Erro ao conectar Meta.");
    const base = NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    return NextResponse.redirect(`${base}/welcome?meta_error=${msg}`);
  }
}
