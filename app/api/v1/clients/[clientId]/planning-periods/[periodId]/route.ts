import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { updatePeriod } from "@/server/services/planningPeriodService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string; periodId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId, periodId } = await params;
    await assertClientAccess(user, clientId);
    const body = (await req.json().catch(() => ({}))) ?? {};
    const period = await updatePeriod(clientId, periodId, {
      label: typeof body.label === "string" ? body.label : undefined,
      startDate: typeof body.startDate === "string" ? body.startDate : undefined,
      campaignContext:
        typeof body.campaignContext === "string" ? body.campaignContext : undefined,
    });
    return NextResponse.json({ period });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
