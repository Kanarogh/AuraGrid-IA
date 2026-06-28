import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { POSTS_WRITE } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { purgeUnreferencedMediaAssets } from "@/server/services/mediaService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

/** Remove linhas em media_assets (e blobs) que não são referenciadas por catálogo, grid ou posts. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, POSTS_WRITE);
    const removed = await purgeUnreferencedMediaAssets(clientId);
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
