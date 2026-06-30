import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { META_CONNECT } from "@/server/http/publishAccess";
import { errorResponse } from "@/server/http/respond";
import { buildLinkedInOAuthStartUrl } from "@/server/services/linkedinOAuthService";
import { buildPinterestOAuthStartUrl } from "@/server/services/pinterestOAuthService";
import { buildMetaOAuthStartUrl } from "@/server/services/metaOAuthService";
import { isPublishPlatform } from "@/src/lib/publish/platforms";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string; platform: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId, platform: rawPlatform } = await params;
    if (!isPublishPlatform(rawPlatform)) {
      return NextResponse.json({ error: "Plataforma inválida." }, { status: 400 });
    }
    await assertClientAccess(user, clientId, META_CONNECT);

    let url: string;
    if (rawPlatform === "instagram" || rawPlatform === "facebook") {
      url = buildMetaOAuthStartUrl(clientId, user.id);
    } else if (rawPlatform === "linkedin") {
      url = buildLinkedInOAuthStartUrl(clientId, user.id);
    } else {
      url = buildPinterestOAuthStartUrl(clientId, user.id);
    }

    return NextResponse.redirect(url);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
