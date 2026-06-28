import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { PUBLISH_WRITE } from "@/server/http/publishAccess";
import { errorResponse } from "@/server/http/respond";
import { retryPublishJob } from "@/server/services/publishJobService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string; jobId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId, jobId } = await params;
    await assertClientAccess(user, clientId, PUBLISH_WRITE);
    const job = await retryPublishJob(clientId, jobId);
    return NextResponse.json({ job });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
