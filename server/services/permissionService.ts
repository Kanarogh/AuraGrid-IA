import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { clientMemberAccess, clients, teamMembers, users } from "../db/schema";
import type { AuthUser } from "./authService";
import type { ClientPermissions } from "@/src/lib/permissions/types";
import {
  canAccessSection,
  canPerformAction,
  OWNER_PERMISSIONS,
} from "@/src/lib/permissions/roleTemplates";
import type {
  AccountRole,
  AuthUserProfile,
  ClientAccessGrant,
  PermissionSection,
  ResolvedClientAccess,
  UserStatus,
  ClientActions,
} from "@/src/lib/permissions/types";
import { HttpError } from "../http/respond";

function parsePermissions(row: {
  sections: unknown;
  actions: unknown;
}): ClientPermissions {
  const sections =
    row.sections && typeof row.sections === "object"
      ? (row.sections as ClientPermissions["sections"])
      : {};
  const actions =
    row.actions && typeof row.actions === "object"
      ? (row.actions as ClientPermissions["actions"])
      : {};
  return { sections, actions };
}

export async function getUserRow(userId: string) {
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function isAccountOwner(userId: string): Promise<boolean> {
  const row = await getUserRow(userId);
  return row?.accountRole === "owner";
}

export async function getTeamOwnerIdForMember(userId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ ownerUserId: teamMembers.ownerUserId })
    .from(teamMembers)
    .where(eq(teamMembers.memberUserId, userId))
    .limit(1);
  return row?.ownerUserId ?? null;
}

export async function assertTeamAdmin(user: AuthUser): Promise<void> {
  const row = await getUserRow(user.id);
  if (!row || row.accountRole !== "owner" || row.status !== "active") {
    throw new HttpError(403, "Acesso restrito ao administrador da conta.");
  }
}

export async function assertUserActive(userId: string): Promise<void> {
  const row = await getUserRow(userId);
  if (!row || row.status !== "active") {
    throw new HttpError(403, "Conta suspensa ou indisponível.");
  }
}

export async function listAccessibleClientIds(userId: string): Promise<string[]> {
  const db = getDb();
  const owned = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.ownerUserId, userId), isNull(clients.deletedAt)));
  const granted = await db
    .select({ clientId: clientMemberAccess.clientId })
    .from(clientMemberAccess)
    .innerJoin(clients, eq(clients.id, clientMemberAccess.clientId))
    .innerJoin(
      teamMembers,
      and(
        eq(teamMembers.memberUserId, clientMemberAccess.userId),
        eq(teamMembers.ownerUserId, clients.ownerUserId)
      )
    )
    .innerJoin(users, eq(users.id, clientMemberAccess.userId))
    .where(
      and(
        eq(clientMemberAccess.userId, userId),
        isNull(clients.deletedAt),
        eq(users.status, "active")
      )
    );
  const ids = new Set<string>();
  for (const r of owned) ids.add(r.id);
  for (const r of granted) ids.add(r.clientId);
  return [...ids];
}

export async function resolveClientAccess(
  userId: string,
  clientId: string
): Promise<ResolvedClientAccess | null> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    .limit(1);
  if (!client) return null;

  if (client.ownerUserId === userId) {
    return {
      clientId,
      level: "owner",
      permissions: OWNER_PERMISSIONS,
    };
  }

  const memberRow = await getUserRow(userId);
  if (!memberRow || memberRow.status !== "active" || memberRow.accountRole !== "member") {
    return null;
  }

  const [membership] = await db
    .select({ displayRole: teamMembers.displayRole })
    .from(teamMembers)
    .where(and(eq(teamMembers.memberUserId, userId), eq(teamMembers.ownerUserId, client.ownerUserId)))
    .limit(1);
  if (!membership) return null;

  const [grant] = await db
    .select()
    .from(clientMemberAccess)
    .where(and(eq(clientMemberAccess.userId, userId), eq(clientMemberAccess.clientId, clientId)))
    .limit(1);
  if (!grant) return null;

  return {
    clientId,
    level: "member",
    displayRole: membership.displayRole as ResolvedClientAccess["displayRole"],
    permissions: parsePermissions(grant),
  };
}

export type AssertClientAccessOptions = {
  section?: PermissionSection;
  minLevel?: "read" | "write";
  action?: keyof ClientActions;
};

export async function assertClientAccessResolved(
  user: AuthUser,
  clientId: string,
  opts?: AssertClientAccessOptions
): Promise<ResolvedClientAccess> {
  await assertUserActive(user.id);
  const access = await resolveClientAccess(user.id, clientId);
  if (!access) throw new HttpError(404, "Cliente não encontrado.");

  if (opts?.section && opts.minLevel) {
    if (!canAccessSection(access.permissions, opts.section, opts.minLevel)) {
      throw new HttpError(404, "Cliente não encontrado.");
    }
  }

  if (opts?.action && !canPerformAction(access.permissions, opts.action)) {
    throw new HttpError(404, "Cliente não encontrado.");
  }

  return access;
}

export async function listClientGrantsForUser(userId: string): Promise<ClientAccessGrant[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(clientMemberAccess)
    .where(eq(clientMemberAccess.userId, userId));
  return rows.map((r) => ({
    clientId: r.clientId,
    permissions: parsePermissions(r),
  }));
}

export async function buildAuthUserProfile(userId: string): Promise<AuthUserProfile | null> {
  const row = await getUserRow(userId);
  if (!row) return null;

  const teamOwnerId =
    row.accountRole === "member" ? await getTeamOwnerIdForMember(userId) : undefined;
  const clientGrants =
    row.accountRole === "member" ? await listClientGrantsForUser(userId) : [];

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    accountRole: row.accountRole as AccountRole,
    mustChangePassword: row.mustChangePassword,
    status: row.status as UserStatus,
    teamOwnerId: teamOwnerId ?? undefined,
    clientGrants,
  };
}

export async function listUsersWithClientSyncAccess(clientId: string): Promise<string[]> {
  const db = getDb();
  const [client] = await db
    .select({ ownerUserId: clients.ownerUserId })
    .from(clients)
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
    .limit(1);
  if (!client) return [];

  const members = await db
    .select({ userId: clientMemberAccess.userId })
    .from(clientMemberAccess)
    .innerJoin(users, eq(users.id, clientMemberAccess.userId))
    .where(and(eq(clientMemberAccess.clientId, clientId), eq(users.status, "active")));

  const ids = new Set<string>([client.ownerUserId]);
  for (const m of members) ids.add(m.userId);
  return [...ids];
}

export async function assertClientOwner(user: AuthUser, clientId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.ownerUserId, user.id),
        isNull(clients.deletedAt)
      )
    )
    .limit(1);
  if (!row) throw new HttpError(404, "Cliente não encontrado.");
}
