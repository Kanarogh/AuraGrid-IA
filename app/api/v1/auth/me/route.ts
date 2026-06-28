import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { buildAuthUserProfile } from "@/server/services/permissionService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    const profile = await buildAuthUserProfile(user.id);
    if (!profile) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ user: profile });
  } catch (err) {
    return errorResponse(err, 401);
  }
}
