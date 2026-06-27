import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import {
  getClientPublishPrefs,
  saveClientPublishPrefs,
} from "@/server/services/publishPrefsService";
import { publishPrefsSchema } from "@/server/validation/publishSchema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    const prefs = await getClientPublishPrefs(clientId);
    return NextResponse.json(prefs);
  } catch (err) {
    return errorResponse(err, 401);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);
    const body = await req.json();
    const validated = publishPrefsSchema.parse(body);
    const prefs = await saveClientPublishPrefs(clientId, validated);
    return NextResponse.json(prefs);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
