import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/http/auth";
import { errorResponse } from "@/server/http/respond";
import { changeUserPassword } from "@/server/services/authService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authUser = requireUser(req);
    const { currentPassword, newPassword } = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Senha atual e nova senha são obrigatórias." },
        { status: 400 }
      );
    }
    const user = await changeUserPassword({
      userId: authUser.id,
      currentPassword,
      newPassword,
    });
    return NextResponse.json({ user });
  } catch (err) {
    return errorResponse(err, 400);
  }
}
