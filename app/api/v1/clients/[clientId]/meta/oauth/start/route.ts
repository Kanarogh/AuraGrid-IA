import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { META_CONNECT } from "@/server/http/publishAccess";
import { errorResponse } from "@/server/http/respond";
import { buildMetaOAuthStartUrl } from "@/server/services/metaOAuthService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, META_CONNECT);
    const url = buildMetaOAuthStartUrl(clientId, user.id);
    return NextResponse.redirect(url);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
