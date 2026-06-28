import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { CONTENT_SCHEDULE_READ } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { getSyncRevision } from "@/server/services/syncRevisionService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, CONTENT_SCHEDULE_READ);
    const periodId = req.nextUrl.searchParams.get("periodId") ?? undefined;
    const revision = await getSyncRevision(user.id, clientId, periodId);
    return NextResponse.json(revision);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
