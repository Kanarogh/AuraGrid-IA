import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import {
  getMetaConnectionPublic,
  revokeMetaConnection,
} from "@/server/services/metaConnectionService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    const connection = await getMetaConnectionPublic(clientId);
    return NextResponse.json(connection);
  } catch (err) {
    return errorResponse(err, 401);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    await revokeMetaConnection(clientId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
