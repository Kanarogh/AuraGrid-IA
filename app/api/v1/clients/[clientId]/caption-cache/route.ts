import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { POSTS_READ } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { clearCaptionCache } from "@/server/services/captionCacheService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, POSTS_READ);
    await clearCaptionCache(clientId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
