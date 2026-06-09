import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { loadWorkspaceDto, patchWorkspace } from "@/server/services/clientService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    const workspace = await loadWorkspaceDto(user.id, clientId);
    return NextResponse.json(workspace);
  } catch (err) {
    return errorResponse(err, 404);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    const body = (await req.json().catch(() => ({}))) ?? {};
    await patchWorkspace(user.id, clientId, body);
    const workspace = await loadWorkspaceDto(user.id, clientId);
    return NextResponse.json(workspace);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
