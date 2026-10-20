import { db } from "@/lib/db";

export type TenantScope = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  church: { id: string; status: string };
  isCrossTenant: boolean;
};

export function canAccessTenant(
  user: { isPlatformAdmin: boolean },
  currentChurchId: string | null,
  requestedChurchId?: string
) {
  if (!requestedChurchId || requestedChurchId === currentChurchId) return true;
  return user.isPlatformAdmin;
}

export function tenantOwnsResource(ownerChurchId: string | null | undefined, resolvedChurchId: string | null | undefined) {
  return Boolean(ownerChurchId && resolvedChurchId && ownerChurchId === resolvedChurchId);
}
import { getCurrentUser } from "@/lib/auth";

export async function requireCurrentChurch(options: { allowUnsubscribed?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user?.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  const church = await db.church.findUnique({ where: { id: user.churchId } });
  if (!church || church.status !== "ACTIVE") throw new Error("The current church is unavailable.");
  if (!options.allowUnsubscribed && !await db.subscription.findFirst({ where: { churchId: church.id, status: "ACTIVE" }, select: { id: true } })) {
    throw new Error("An active subscription is required to access this administrative feature.");
  }
  return { user, church };
}

export async function requirePlatformAdmin() {
  const user = await getCurrentUser();
  if (!user?.isPlatformAdmin) throw new Error("Platform administrator access is required.");
  return user;
}

/**
 * Resolve a tenant for privileged, read-only cross-tenant features. The
 * requested id is never accepted for ordinary users, even if they know a
 * valid tenant id.
 */
export async function requireTenantScope(requestedChurchId?: string): Promise<TenantScope> {
  const user = await getCurrentUser();
  if (!user) throw new Error("The authenticated user is not assigned to an active church.");
  const isCrossTenant = Boolean(requestedChurchId && requestedChurchId !== user.churchId);
  if (!isCrossTenant) {
    const current = await requireCurrentChurch();
    return { ...current, isCrossTenant: false };
  }
  if (!canAccessTenant(user, user.churchId, requestedChurchId)) throw new Error("Platform administrator access is required for cross-tenant access.");
  const church = await db.church.findUnique({ where: { id: requestedChurchId }, select: { id: true, status: true } });
  if (!church || church.status !== "ACTIVE") throw new Error("The requested church is unavailable.");
  return { user, church, isCrossTenant: true };
}

export const requireGlobalAdminScope = requireTenantScope;
