import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { setActiveClient } from "@/server/services/clientService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    await setActiveClient(user.id, clientId);
    return NextResponse.json({ ok: true, activeClientId: clientId });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
