import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { CATALOG_WRITE } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { clearCatalogEnrichments } from "@/server/services/catalogService";
import { getEffectiveUsesReferences } from "@/server/services/planningPeriodService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, CATALOG_WRITE);
    const usesReferences = await getEffectiveUsesReferences(clientId);
    if (!usesReferences) {
      return NextResponse.json(
        { error: "Este roteiro não usa referências de catálogo." },
        { status: 400 }
      );
    }
    const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
    const result = await clearCatalogEnrichments(clientId, ids);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
