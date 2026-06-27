import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { patchPublishJob } from "@/server/services/publishJobService";
import { patchJobSchema } from "@/server/validation/publishSchema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string; jobId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId, jobId } = await params;
    await assertClientAccess(user, clientId);
    const body = await req.json();
    const validated = patchJobSchema.parse(body);
    const job = await patchPublishJob(clientId, jobId, validated);
    return NextResponse.json({ job });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
