import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { PUBLISH_READ, META_CONNECT } from "@/server/http/publishAccess";
import { errorResponse } from "@/server/http/respond";
import { isLinkedInOAuthConfigured } from "@/server/config/linkedinEnv";
import { isPinterestOAuthConfigured } from "@/server/config/pinterestEnv";
import { listSocialConnectionsPublic } from "@/server/services/socialConnectionService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, PUBLISH_READ);
    const connections = await listSocialConnectionsPublic(clientId, {
      linkedin: isLinkedInOAuthConfigured(),
      pinterest: isPinterestOAuthConfigured(),
    });
    return NextResponse.json({ connections });
  } catch (err) {
    return errorResponse(err, 401);
  }
}
