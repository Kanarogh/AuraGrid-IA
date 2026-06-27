import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { checkRateLimit } from "@/server/http/rateLimit";
import { errorResponse, HttpError } from "@/server/http/respond";
import { setActiveClient } from "@/server/services/clientService";

export const dynamic = "force-dynamic";

/** Evita loops do front (ex.: sync de rota) de saturar o edge/WAF. */
const ACTIVATE_MAX_PER_WINDOW = 20;
const ACTIVATE_WINDOW_MS = 60_000;

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId);

    const limit = checkRateLimit(
      `client-activate:${user.id}:${clientId}`,
      ACTIVATE_MAX_PER_WINDOW,
      ACTIVATE_WINDOW_MS
    );
    if (!limit.ok) {
      throw new HttpError(
        429,
        `Muitas ativações seguidas. Aguarde ${limit.retryAfterSec}s e recarregue a página.`
      );
    }

    await setActiveClient(user.id, clientId);
    return NextResponse.json({ ok: true, activeClientId: clientId });
  } catch (err) {
    if (err instanceof HttpError && err.status === 429) {
      const retryAfterSec = /Aguarde (\d+)s/.exec(err.message)?.[1];
      const headers = retryAfterSec
        ? { "Retry-After": retryAfterSec }
        : undefined;
      return NextResponse.json({ error: err.message }, { status: 429, headers });
    }
    return errorResponse(err, 400);
  }
}
