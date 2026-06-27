import { NextResponse, type NextRequest } from "next/server";
import { isDatabaseConfigured } from "@/server/db/client";
import { requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import {
  getUserAppearanceSettings,
  saveUserAppearanceSettings,
} from "@/server/services/userAppearancePreferencesService";
import { parseAppearanceSettingsBody } from "@/server/validation/appearanceSchema";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
    }
    const user = requireUser(req);
    const settings = await getUserAppearanceSettings(user.id);
    return NextResponse.json(settings);
  } catch (err) {
    return errorResponse(err, 401);
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });
    }
    const user = requireUser(req);
    const body = await req.json();
    const validated = parseAppearanceSettingsBody(body);
    const settings = await saveUserAppearanceSettings(user.id, validated);
    return NextResponse.json(settings);
  } catch (err) {
    return errorResponse(err, 400);
  }
}
