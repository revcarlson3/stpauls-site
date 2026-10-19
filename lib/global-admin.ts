import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { OnboardingStatus, TenantLifecycleStatus } from "@prisma/client";

export const GLOBAL_ADMIN_BOUNDARY = "global-admin" as const;
export const SELECTED_CHURCH_COOKIE = "global-admin-church";
export const GLOBAL_ADMIN_REAUTH_COOKIE = "global-admin-reauth";
const REAUTH_WINDOW_SECONDS = 15 * 60;
export const lifecycleActions = ["enable", "activate", "suspend", "disable"] as const;
export type LifecycleAction = (typeof lifecycleActions)[number];
export type LifecycleState = { lifecycleStatus: TenantLifecycleStatus; onboardingStatus: OnboardingStatus };

export function hasRecentReauthentication(reauthenticatedAt: number | undefined, now = Math.floor(Date.now() / 1000)) {
  return typeof reauthenticatedAt === "number" && reauthenticatedAt >= now - REAUTH_WINDOW_SECONDS;
}

export function createGlobalAdminReauthToken(userId: string, sessionVersion: number, now = Math.floor(Date.now() / 1000)) {
  const payload = `${userId}.${sessionVersion}.${now}`;
  const signature = crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "development-only-config-key").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function hasValidGlobalAdminReauthToken(token: string | undefined, userId: string, sessionVersion: number, now = Math.floor(Date.now() / 1000)) {
  if (!token) return false;
  const [tokenUserId, tokenSessionVersion, tokenTimestamp, signature] = token.split(".");
  if (tokenUserId !== userId || tokenSessionVersion !== String(sessionVersion) || !/^\d+$/.test(tokenTimestamp ?? "") || now - Number(tokenTimestamp) < 0 || now - Number(tokenTimestamp) > REAUTH_WINDOW_SECONDS || !signature) return false;
  const expected = createGlobalAdminReauthToken(tokenUserId, sessionVersion, Number(tokenTimestamp)).split(".").at(-1);
  return Boolean(expected && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)));
}

export function isActiveSelectedChurch(selectedChurchId: string | null, church: { id: string; status: "ACTIVE" | "SUSPENDED" } | null) {
  return Boolean(selectedChurchId && church?.id === selectedChurchId && church.status === "ACTIVE");
}

export function nextLifecycleState(state: LifecycleState, action: LifecycleAction): LifecycleState | null {
  const nextStatus: Record<LifecycleAction, TenantLifecycleStatus[]> = {
    enable: ["PROVISIONING"],
    activate: ["ACTIVE"],
    suspend: ["SUSPENDED"],
    disable: ["DISABLED"]
  };
  const allowed: Record<LifecycleAction, TenantLifecycleStatus[]> = {
    enable: ["DISABLED"],
    activate: ["PROVISIONING", "SUSPENDED"],
    suspend: ["ACTIVE"],
    disable: ["ACTIVE", "SUSPENDED"]
  };
  if (!allowed[action].includes(state.lifecycleStatus)) return null;
  const lifecycleStatus = nextStatus[action][0];
  return { lifecycleStatus, onboardingStatus: lifecycleStatus === "ACTIVE" ? "COMPLETE" : state.onboardingStatus };
}

export function lifecycleAuditMetadata(action: LifecycleAction, from: LifecycleState, to: LifecycleState) {
  return { action, fromLifecycleStatus: from.lifecycleStatus, toLifecycleStatus: to.lifecycleStatus, onboardingStatus: to.onboardingStatus };
}

export function buildGlobalAuditDetails(input: { churchId?: string; scope?: "platform" | "site"; targetType: string; targetId?: string; metadata?: Record<string, unknown> }) {
  return JSON.stringify({ boundary: GLOBAL_ADMIN_BOUNDARY, ...(input.scope ? { scope: input.scope } : {}), selectedChurchId: input.churchId ?? null, targetType: input.targetType, targetId: input.targetId ?? null, metadata: input.metadata ?? {} });
}

export function isGlobalAdminSession(session: { user?: { authBoundary?: string; mfaPending?: boolean; globalAdminMfaSetupRequired?: boolean } } | null) {
  return session?.user?.authBoundary === GLOBAL_ADMIN_BOUNDARY && session.user.mfaPending !== true && session.user.globalAdminMfaSetupRequired !== true;
}

export async function requireGlobalAdmin(options: { selectedChurch?: boolean; sensitive?: boolean } = {}) {
  const session = await getServerSession(authOptions);
  if (!session || !isGlobalAdminSession(session) || !session.user?.id) throw new Error("Unauthorized: bridge access is required.");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, isActive: true, isPlatformAdmin: true, sessionVersion: true } });
  if (!user?.isActive || !user.isPlatformAdmin) throw new Error("Unauthorized: platform administrator access is required.");
  if (options.sensitive) {
    const reauthenticatedAt = session.user.reauthenticatedAt ?? 0;
    const reauthCookie = cookies().get(GLOBAL_ADMIN_REAUTH_COOKIE)?.value;
    if (!hasRecentReauthentication(reauthenticatedAt) && !hasValidGlobalAdminReauthToken(reauthCookie, user.id, user.sessionVersion)) throw new Error("Reauthentication required.");
  }
  const churchId = cookies().get(SELECTED_CHURCH_COOKIE)?.value ?? null;
  const church = churchId ? await db.church.findUnique({ where: { id: churchId }, select: { id: true, name: true, slug: true } }) : null;
  if (options.selectedChurch && !church) throw new Error("A site must be selected before continuing.");
  return { user, church };
}

export async function transitionSelectedChurchLifecycle(action: LifecycleAction) {
  const context = await requireGlobalAdmin({ selectedChurch: true, sensitive: true });
  const church = await db.church.findUnique({ where: { id: context.church!.id }, select: { id: true, name: true, lifecycleStatus: true, onboardingStatus: true } });
  if (!church) throw new Error("Selected site is unavailable.");
  const from = { lifecycleStatus: church.lifecycleStatus, onboardingStatus: church.onboardingStatus };
  const to = nextLifecycleState(from, action);
  if (!to) throw new Error(`Invalid lifecycle transition: ${from.lifecycleStatus} cannot ${action}.`);
  const updated = await db.$transaction(async (transaction) => {
    const result = await transaction.church.update({
      where: { id: church.id },
      data: { lifecycleStatus: to.lifecycleStatus, onboardingStatus: to.onboardingStatus, status: to.lifecycleStatus === "SUSPENDED" ? "SUSPENDED" : "ACTIVE" },
      select: { id: true, name: true, lifecycleStatus: true, onboardingStatus: true }
    });
    await transaction.auditLog.create({
      data: {
        activityType: "global-admin-lifecycle-changed",
        summary: `Changed ${church.name} lifecycle to ${result.lifecycleStatus.toLowerCase()}.`,
        actorId: context.user.id,
        details: buildGlobalAuditDetails({ churchId: church.id, targetType: "church-lifecycle", targetId: church.id, metadata: lifecycleAuditMetadata(action, from, to) })
      }
    });
    return result;
  });
  return updated;
}

export async function logGlobalAdminAction(input: {
  activityType: Parameters<typeof logAudit>[0]["activityType"];
  summary: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  const context = await requireGlobalAdmin({ selectedChurch: true });
  await logAudit({
    activityType: input.activityType,
    summary: input.summary,
    actorId: context.user.id,
    details: JSON.stringify({
      boundary: GLOBAL_ADMIN_BOUNDARY,
      ...JSON.parse(buildGlobalAuditDetails({ churchId: context.church!.id, targetType: input.targetType, targetId: input.targetId, metadata: input.metadata }))
    })
  });
}
