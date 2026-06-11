import { NextResponse, type NextRequest } from "next/server";
import { applyAiHeadersFromNextRequest } from "@/server/http/aiRequest";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { runCatalogEnrichment } from "@/server/services/enrichQueue";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
    const providerId = await applyAiHeadersFromNextRequest(req);
    void runCatalogEnrichment(clientId, ids, providerId);
    return NextResponse.json({ ok: true, enriching: true });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
