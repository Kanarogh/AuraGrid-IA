import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { PUBLISH_WRITE } from "@/server/http/publishAccess";
import { errorResponse } from "@/server/http/respond";
import { previewScheduleTimes } from "@/server/services/publishJobService";
import { schedulePreviewSchema } from "@/server/validation/publishSchema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, PUBLISH_WRITE);
    const body = await req.json();
    const validated = schedulePreviewSchema.parse(body);
    const suggestions = await previewScheduleTimes(
      clientId,
      validated.planningPeriodId,
      validated.postIds
    );
    return NextResponse.json({ suggestions });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
