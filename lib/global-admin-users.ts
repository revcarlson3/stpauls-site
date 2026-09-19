import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireGlobalAdmin } from "@/lib/global-admin";
import { validatePassword } from "@/lib/password-policy";
import { requestPasswordReset } from "@/lib/account-recovery";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  isPlatformAdmin: true,
  mfaEnabled: true,
  emailMfaEnabled: true,
  smsMfaEnabled: true,
  mfaEnrolledAt: true,
  lastAccessAt: true,
  lastSessionRevokedAt: true,
  sessionVersion: true,
  group: { select: { id: true, name: true } },
  churchMemberships: { select: { role: true }, where: { churchId: "" } }
} as const;

export function isUserInSelectedChurch(userChurchIds: readonly string[], selectedChurchId: string) {
  return userChurchIds.includes(selectedChurchId);
}

export function userSessionState(lastAccessAt: Date | null, lastSessionRevokedAt: Date | null) {
  if (lastSessionRevokedAt && (!lastAccessAt || lastSessionRevokedAt >= lastAccessAt)) return "Revoked";
  if (lastAccessAt) return "Active or expired";
  return "No recorded session";
}

export function buildUserAuditDetails(churchId: string, userId: string, metadata: Record<string, unknown>) {
  return JSON.stringify({ boundary: "global-admin", selectedChurchId: churchId, targetType: "user", targetId: userId, metadata });
}

export async function listSelectedChurchUsers() {
  const context = await requireGlobalAdmin({ selectedChurch: true });
  const users = await db.user.findMany({
    where: { churchMemberships: { some: { churchId: context.church!.id } }, isPlatformAdmin: false },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { ...userSelect, churchMemberships: { select: { role: true }, where: { churchId: context.church!.id } } }
  });
  return users.map(({ id: _id, sessionVersion: _version, isPlatformAdmin: _platformAdmin, ...user }) => ({
    ...user,
    churchRole: user.churchMemberships[0]?.role ?? null,
    churchMemberships: undefined,
    mfaEnrollment: user.mfaEnabled || user.emailMfaEnabled || user.smsMfaEnabled ? "Enrolled" : "Not enrolled",
    sessionState: userSessionState(user.lastAccessAt, user.lastSessionRevokedAt),
    groupId: user.group?.id ?? null
  }));
}

async function requireSelectedUser(userId: string) {
  const context = await requireGlobalAdmin({ selectedChurch: true, sensitive: true });
  const user = await db.user.findFirst({
    where: { id: userId, churchMemberships: { some: { churchId: context.church!.id } } },
    select: { id: true, name: true, email: true, role: true, isActive: true, groupId: true, isPlatformAdmin: true }
  });
  if (!user) throw new Error("Selected user was not found.");
  if (user.id === context.user.id) throw new Error("You cannot change your own bridge account.");
  if (user.isPlatformAdmin) throw new Error("Platform administrator accounts cannot be changed through tenant user management.");
  return { context, user };
}

export async function updateSelectedChurchUser(input: { userId: string; name?: string; email?: string; password?: string; isActive?: boolean; role?: Role; groupId?: string | null }) {
  const { context, user } = await requireSelectedUser(input.userId);
  if (input.name !== undefined && input.name.trim().length < 2) throw new Error("Name must be at least 2 characters.");
  if (input.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new Error("A valid email address is required.");
  if (input.password !== undefined) {
    const passwordError = await validatePassword(input.password);
    if (passwordError) throw new Error(passwordError);
  }
  if (input.groupId) {
    const group = await db.securityGroup.findUnique({ where: { id: input.groupId }, select: { id: true } });
    if (!group) throw new Error("Security group not found.");
  }
  const changedActive = typeof input.isActive === "boolean" && input.isActive !== user.isActive;
  const changedPassword = input.password !== undefined;
  const changedEmail = input.email !== undefined && input.email.trim().toLowerCase() !== user.email;
  const changedIdentity = input.name !== undefined || input.email !== undefined;
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(changedPassword ? { passwordHash: await bcrypt.hash(input.password as string, 12) } : {}),
      ...((changedPassword || changedEmail || changedActive) ? { sessionVersion: { increment: 1 }, lastSessionRevokedAt: new Date() } : {}),
      ...(typeof input.isActive === "boolean" ? { isActive: input.isActive } : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.groupId !== undefined ? { groupId: input.groupId } : {})
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, group: { select: { id: true, name: true } } }
  });
  await logAudit({
    activityType: changedPassword ? "global-admin-user-password-reset" : changedActive ? (updated.isActive ? "global-admin-user-reactivated" : "global-admin-user-deactivated") : "global-admin-user-access-updated",
    summary: `${updated.isActive ? "Updated" : "Deactivated"} selected-site user ${updated.name}.`,
    actorId: context.user.id,
    details: buildUserAuditDetails(context.church!.id, updated.id, { changedFields: [...(changedIdentity ? ["name/email"] : []), ...(input.role !== undefined ? ["role"] : []), ...(input.groupId !== undefined ? ["securityGroup"] : []), ...(typeof input.isActive === "boolean" ? ["active"] : []), ...(changedPassword ? ["password"] : [])], passwordReset: changedPassword })
  });
  return { ...updated, group: updated.group ? { name: updated.group.name } : null };
}

export async function revokeSelectedChurchUserSessions(userId: string) {
  const { context, user } = await requireSelectedUser(userId);
  await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 }, lastSessionRevokedAt: new Date() } });
  await logAudit({ activityType: "global-admin-user-sessions-revoked", summary: `Revoked sessions for selected-site user ${user.name}.`, actorId: context.user.id, details: buildUserAuditDetails(context.church!.id, user.id, { action: "revoke-sessions" }) });
}

export async function requestSelectedChurchUserPasswordReset(userId: string) {
  const { context, user } = await requireSelectedUser(userId);
  await requestPasswordReset(user.email);
  await logAudit({
    activityType: "global-admin-user-password-reset",
    summary: `Sent a password reset link for selected-site user ${user.name}.`,
    actorId: context.user.id,
    details: buildUserAuditDetails(context.church!.id, user.id, { passwordReset: true, delivery: "email" })
  });
}
