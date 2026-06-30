import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { META_CONNECT } from "@/server/http/publishAccess";
import { errorResponse } from "@/server/http/respond";
import { revokeSocialConnection } from "@/server/services/socialConnectionService";
import { revokeMetaConnection } from "@/server/services/metaConnectionService";
import { isMetaPlatform, isPublishPlatform } from "@/src/lib/publish/platforms";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string; platform: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId, platform: rawPlatform } = await params;
    if (!isPublishPlatform(rawPlatform)) {
      return NextResponse.json({ error: "Plataforma inválida." }, { status: 400 });
    }
    await assertClientAccess(user, clientId, META_CONNECT);

    if (isMetaPlatform(rawPlatform)) {
      await revokeMetaConnection(clientId);
    } else {
      await revokeSocialConnection(clientId, rawPlatform);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 401);
  }
}
