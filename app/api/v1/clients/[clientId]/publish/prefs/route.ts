import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { PUBLISH_READ, PUBLISH_WRITE } from "@/server/http/publishAccess";
import { errorResponse } from "@/server/http/respond";
import {
  getClientPublishPrefsPublic,
  saveClientPublishPrefs,
} from "@/server/services/publishPrefsService";
import { publishPrefsSchema } from "@/server/validation/publishSchema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, PUBLISH_READ);
    const prefs = await getClientPublishPrefsPublic(clientId);
    return NextResponse.json(prefs);
  } catch (err) {
    return errorResponse(err, 401);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, PUBLISH_WRITE);
    const body = await req.json();
    const validated = publishPrefsSchema.parse(body);
    const prefs = await saveClientPublishPrefs(clientId, validated);
    return NextResponse.json(prefs);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
