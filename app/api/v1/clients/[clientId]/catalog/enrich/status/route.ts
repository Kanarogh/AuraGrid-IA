import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { getEnrichmentProgress, isEnrichmentRunning } from "@/server/services/enrichQueue";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    const enriching = isEnrichmentRunning(clientId);
    const progress = enriching ? getEnrichmentProgress(clientId) : null;
    return NextResponse.json({ enriching, progress });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
