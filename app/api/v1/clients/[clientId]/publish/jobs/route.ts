import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { PUBLISH_READ, PUBLISH_WRITE } from "@/server/http/publishAccess";
import { errorResponse } from "@/server/http/respond";
import { isPublishMockEnabled } from "@/server/services/publishPrefsService";
import {
  createPublishJobs,
  countPublishedLast24h,
  listPublishQueue,
} from "@/server/services/publishJobService";
import { createJobsSchema } from "@/server/validation/publishSchema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, PUBLISH_READ);
    const periodId = req.nextUrl.searchParams.get("planningPeriodId");
    if (!periodId) {
      return NextResponse.json({ error: "planningPeriodId obrigatório." }, { status: 400 });
    }
    const queue = await listPublishQueue(clientId, periodId);
    const publishedLast24h = await countPublishedLast24h(clientId);
    const summary = {
      eligible: queue.filter((q) => q.status === "eligible").length,
      notReady: queue.filter((q) => q.status === "not_ready").length,
      scheduled: queue.filter((q) => q.status === "queued" || q.status === "publishing").length,
      published: queue.filter((q) => q.status === "published").length,
      failed: queue.filter((q) => q.status === "failed").length,
      publishedLast24h,
      total: queue.length,
      publishMockEnabled: isPublishMockEnabled(),
    };
    return NextResponse.json({ queue, summary });
  } catch (err) {
    return errorResponse(err, 401);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, PUBLISH_WRITE);
    const body = await req.json();
    const validated = createJobsSchema.parse(body);
    const jobs = await createPublishJobs(clientId, user.id, validated);
    return NextResponse.json({ jobs });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
