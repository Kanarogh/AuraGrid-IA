import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import {
  createPublishJobs,
  listPublishQueue,
  previewScheduleTimes,
} from "@/server/services/publishJobService";
import {
  createJobsSchema,
  schedulePreviewSchema,
} from "@/server/validation/publishSchema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    const periodId = req.nextUrl.searchParams.get("planningPeriodId");
    if (!periodId) {
      return NextResponse.json({ error: "planningPeriodId obrigatório." }, { status: 400 });
    }
    const queue = await listPublishQueue(clientId, periodId);
    return NextResponse.json({ queue });
  } catch (err) {
    return errorResponse(err, 401);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    const body = await req.json();
    const validated = createJobsSchema.parse(body);
    const jobs = await createPublishJobs(clientId, user.id, validated);
    return NextResponse.json({ jobs });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
