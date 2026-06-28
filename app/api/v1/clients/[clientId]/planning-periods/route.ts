import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import {
  CONTENT_SCHEDULE_MANAGE,
  CONTENT_SCHEDULE_READ,
} from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { loadWorkspaceDto } from "@/server/services/clientService";
import {
  activatePeriod,
  archivePeriod,
  createPeriod,
  listPeriodsForClient,
  updatePeriod,
} from "@/server/services/planningPeriodService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, CONTENT_SCHEDULE_READ);
    const periods = await listPeriodsForClient(clientId);
    return NextResponse.json({ periods });
  } catch (err) {
    return errorResponse(err, 404);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, CONTENT_SCHEDULE_MANAGE);
    const body = (await req.json().catch(() => ({}))) ?? {};
    const period = await createPeriod(clientId, {
      label: typeof body.label === "string" ? body.label : undefined,
      startDate: typeof body.startDate === "string" ? body.startDate : undefined,
      sourcePeriodId:
        typeof body.sourcePeriodId === "string" ? body.sourcePeriodId : undefined,
      activate: body.activate !== false,
      usesReferences:
        body.usesReferences === true || body.usesReferences === false
          ? body.usesReferences
          : body.usesReferences === null
            ? null
            : undefined,
    });
    const workspace = await loadWorkspaceDto(user.id, clientId, period.id);
    return NextResponse.json({ period, workspace }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
