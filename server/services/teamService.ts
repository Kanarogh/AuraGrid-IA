import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  clientMemberAccess,
  refreshTokens,
  teamMembers,
  users,
} from "../db/schema";
import { permissionsForRole } from "@/src/lib/permissions/roleTemplates";
import type { ClientPermissions, DisplayRole } from "@/src/lib/permissions/types";
import { assertClientOwner, assertTeamAdmin } from "./permissionService";
import type { AuthUser } from "./authService";

export type TeamMemberDto = {
  userId: string;
  email: string;
  displayName: string;
  status: string;
  displayRole: DisplayRole;
  mustChangePassword: boolean;
  clientAccess: Array<{ clientId: string; permissions: ClientPermissions }>;
  createdAt: string;
};

export function generateTemporaryPassword(): string {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

export async function listTeamMembers(ownerUserId: string): Promise<TeamMemberDto[]> {
  const db = getDb();
  const memberships = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.ownerUserId, ownerUserId));

  const result: TeamMemberDto[] = [];
  for (const m of memberships) {
    const [user] = await db.select().from(users).where(eq(users.id, m.memberUserId)).limit(1);
    if (!user) continue;
    const grants = await db
      .select()
      .from(clientMemberAccess)
      .where(eq(clientMemberAccess.userId, m.memberUserId));
    result.push({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      displayRole: m.displayRole as DisplayRole,
      mustChangePassword: user.mustChangePassword,
      clientAccess: grants.map((g) => ({
        clientId: g.clientId,
        permissions: {
          sections: (g.sections as ClientPermissions["sections"]) ?? {},
          actions: (g.actions as ClientPermissions["actions"]) ?? {},
        },
      })),
      createdAt: m.createdAt.toISOString(),
    });
  }
  return result;
}

export type CreateTeamMemberInput = {
  email: string;
  displayName: string;
  temporaryPassword: string;
  displayRole: DisplayRole;
  clientIds: string[];
  permissions?: ClientPermissions;
  permissionsByClient?: Record<string, ClientPermissions>;
};

export async function createTeamMember(
  owner: AuthUser,
  input: CreateTeamMemberInput
): Promise<{ userId: string }> {
  await assertTeamAdmin(owner);
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  if (!email || input.temporaryPassword.length < 8) {
    throw new Error("E-mail e senha temporária (mín. 8 caracteres) são obrigatórios.");
  }

  for (const clientId of input.clientIds) {
    await assertClientOwner(owner, clientId);
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) throw new Error("E-mail já cadastrado.");

  const passwordHash = await bcrypt.hash(input.temporaryPassword, 12);
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      displayName: input.displayName.trim() || email.split("@")[0] || "Membro",
      accountRole: "member",
      mustChangePassword: true,
      status: "active",
      invitedByUserId: owner.id,
    })
    .returning();

  await db.insert(teamMembers).values({
    ownerUserId: owner.id,
    memberUserId: user!.id,
    displayRole: input.displayRole,
  });

  const basePermissions =
    input.permissions ?? permissionsForRole(input.displayRole);

  for (const clientId of input.clientIds) {
    const perms = input.permissionsByClient?.[clientId] ?? basePermissions;
    await db.insert(clientMemberAccess).values({
      userId: user!.id,
      clientId,
      grantedByUserId: owner.id,
      sections: perms.sections,
      actions: perms.actions,
    });
  }

  return { userId: user!.id };
}

export type UpdateTeamMemberInput = {
  displayName?: string;
  status?: "active" | "suspended";
  displayRole?: DisplayRole;
  clientIds?: string[];
  permissions?: ClientPermissions;
  permissionsByClient?: Record<string, ClientPermissions>;
  resetTemporaryPassword?: string;
};

export async function updateTeamMember(
  owner: AuthUser,
  memberUserId: string,
  input: UpdateTeamMemberInput
): Promise<void> {
  await assertTeamAdmin(owner);
  const db = getDb();

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.ownerUserId, owner.id), eq(teamMembers.memberUserId, memberUserId))
    )
    .limit(1);
  if (!membership) throw new Error("Membro não encontrado.");

  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (input.displayName !== undefined) patch.displayName = input.displayName.trim();
  if (input.status !== undefined) patch.status = input.status;
  if (input.resetTemporaryPassword) {
    if (input.resetTemporaryPassword.length < 8) throw new Error("Senha temporária inválida.");
    patch.passwordHash = await bcrypt.hash(input.resetTemporaryPassword, 12);
    patch.mustChangePassword = true;
  }
  if (Object.keys(patch).length > 1) {
    await db.update(users).set(patch).where(eq(users.id, memberUserId));
  }
  if (input.status === "suspended") {
    await revokeAllRefreshTokens(memberUserId);
  }

  if (input.displayRole) {
    await db
      .update(teamMembers)
      .set({ displayRole: input.displayRole })
      .where(
        and(eq(teamMembers.ownerUserId, owner.id), eq(teamMembers.memberUserId, memberUserId))
      );
  }

  if (input.clientIds) {
    for (const clientId of input.clientIds) {
      await assertClientOwner(owner, clientId);
    }
    await db
      .delete(clientMemberAccess)
      .where(eq(clientMemberAccess.userId, memberUserId));
    const role = (input.displayRole ?? membership.displayRole) as DisplayRole;
    const base = input.permissions ?? permissionsForRole(role);
    for (const clientId of input.clientIds) {
      const perms = input.permissionsByClient?.[clientId] ?? base;
      await db.insert(clientMemberAccess).values({
        userId: memberUserId,
        clientId,
        grantedByUserId: owner.id,
        sections: perms.sections,
        actions: perms.actions,
      });
    }
  }
}

export async function deleteTeamMember(owner: AuthUser, memberUserId: string): Promise<void> {
  await assertTeamAdmin(owner);
  const db = getDb();
  await db.delete(clientMemberAccess).where(eq(clientMemberAccess.userId, memberUserId));
  await db
    .delete(teamMembers)
    .where(
      and(eq(teamMembers.ownerUserId, owner.id), eq(teamMembers.memberUserId, memberUserId))
    );
  await revokeAllRefreshTokens(memberUserId);
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}
