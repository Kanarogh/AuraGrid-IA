import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { assertTeamAdmin } from "@/server/services/permissionService";
import {
  createClientForUser,
  getActiveClientId,
  listClientsForUser,
} from "@/server/services/clientService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    const clients = await listClientsForUser(user.id);
    const activeClientId = await getActiveClientId(user.id);
    return NextResponse.json({
      version: 1,
      activeClientId: activeClientId ?? clients[0]?.id ?? "",
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        instagramHandle: c.instagramHandle ?? c.id.replace(/-/g, "_"),
        defaultUsesReferences: c.defaultUsesReferences ?? true,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    return errorResponse(err, 401);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    await assertTeamAdmin(user);
    const { name, slug } = (await req.json()) as { name?: string; slug?: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: "Nome da marca é obrigatório." }, { status: 400 });
    }
    const created = await createClientForUser(user.id, name, slug);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
