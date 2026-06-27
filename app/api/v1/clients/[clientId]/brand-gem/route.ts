import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { parseBrandGemSaveBody } from "@/server/validation/brandGemSchema";
import { saveBrandGem } from "@/server/services/clientService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    const body = await req.json();
    const validated = parseBrandGemSaveBody(body);
    const savedAt = await saveBrandGem(user.id, clientId, validated);
    return NextResponse.json({ savedAt });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
