import { NextResponse, type NextRequest } from "next/server";
import { assertClientAccess, requireUser } from "@/server/http/auth";
import { SETTINGS_READ } from "@/server/http/sectionAccess";
import { errorResponse } from "@/server/http/respond";
import { getAiUsageSummary } from "@/server/services/aiUsageService";
import { getGoogleQuotaSnapshot } from "@/server/services/googleQuotaService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = requireUser(req);
    const { clientId } = await params;
    await assertClientAccess(user, clientId, SETTINGS_READ);

    const windowParam = req.nextUrl.searchParams.get("window");
    const window = windowParam === "rolling_30d" ? "rolling_30d" : "rolling_30d";
    const [usage, googleQuota] = await Promise.all([
      getAiUsageSummary({ userId: user.id, clientId, window }),
      getGoogleQuotaSnapshot(),
    ]);

    return NextResponse.json({
      window,
      usage,
      googleQuota,
    });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
