import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { CONTENT_SCHEDULE_MANAGE } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { loadWorkspaceDto } from "@/server/services/clientService";
import { activatePeriod } from "@/server/services/planningPeriodService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string; periodId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId, periodId } = await params;
    await assertClientAccess(user, clientId, CONTENT_SCHEDULE_MANAGE);
    const period = await activatePeriod(clientId, periodId);
    const workspace = await loadWorkspaceDto(user.id, clientId, periodId);
    return NextResponse.json({ period, workspace });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
