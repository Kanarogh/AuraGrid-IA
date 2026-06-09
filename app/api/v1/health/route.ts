import { NextResponse } from "next/server";
import { buildExtendedHealth } from "@/server/http/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildExtendedHealth());
}
