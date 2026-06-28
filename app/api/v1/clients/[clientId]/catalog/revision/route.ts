import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { CATALOG_WRITE } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { getCatalogRevision } from "@/server/services/catalogService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, CATALOG_WRITE);
    const periodId = req.nextUrl.searchParams.get("periodId") ?? undefined;
    const revision = await getCatalogRevision(clientId, periodId);
    return NextResponse.json(revision);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
