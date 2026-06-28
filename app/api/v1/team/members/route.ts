import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { assertTeamAdmin } from "@/server/services/permissionService";
import { createTeamMember, listTeamMembers } from "@/server/services/teamService";
import type { ClientPermissions, DisplayRole } from "@/src/lib/permissions/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    await assertTeamAdmin(user);
    const members = await listTeamMembers(user.id);
    return NextResponse.json({ members });
  } catch (err) {
    return errorResponse(err, 403);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    const body = (await req.json()) as {
      email?: string;
      displayName?: string;
      temporaryPassword?: string;
      displayRole?: DisplayRole;
      clientIds?: string[];
      permissions?: ClientPermissions;
      permissionsByClient?: Record<string, ClientPermissions>;
    };
    if (!body.email?.trim() || !body.temporaryPassword || !body.clientIds?.length) {
      return NextResponse.json(
        { error: "E-mail, senha temporária e pelo menos um cliente são obrigatórios." },
        { status: 400 }
      );
    }
    const result = await createTeamMember(user, {
      email: body.email,
      displayName: body.displayName ?? body.email.split("@")[0] ?? "Membro",
      temporaryPassword: body.temporaryPassword,
      displayRole: body.displayRole ?? "editor",
      clientIds: body.clientIds,
      permissions: body.permissions,
      permissionsByClient: body.permissionsByClient,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
