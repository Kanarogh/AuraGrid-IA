import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { MANAGE_CLIENTS } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { loadWorkspaceDto, resetClientWorkspace } from "@/server/services/clientService";
import { clearCaptionCache } from "@/server/services/captionCacheService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, MANAGE_CLIENTS);
    await resetClientWorkspace(user.id, clientId);
    await clearCaptionCache(clientId);
    const workspace = await loadWorkspaceDto(user.id, clientId);
    return NextResponse.json(workspace);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
