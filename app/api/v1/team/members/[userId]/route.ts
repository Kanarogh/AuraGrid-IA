import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { deleteTeamMember, updateTeamMember } from "@/server/services/teamService";
import type { ClientPermissions, DisplayRole } from "@/src/lib/permissions/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const owner = requireUser(req);
    const { userId: memberUserId } = await params;
    const body = (await req.json()) as {
      displayName?: string;
      status?: "active" | "suspended";
      displayRole?: DisplayRole;
      clientIds?: string[];
      permissions?: ClientPermissions;
      permissionsByClient?: Record<string, ClientPermissions>;
      resetTemporaryPassword?: string;
    };
    await updateTeamMember(owner, memberUserId, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const owner = requireUser(req);
    const { userId: memberUserId } = await params;
    await deleteTeamMember(owner, memberUserId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
