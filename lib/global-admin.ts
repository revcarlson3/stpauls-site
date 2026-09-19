import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const GLOBAL_ADMIN_BOUNDARY = "global-admin" as const;
export const SELECTED_CHURCH_COOKIE = "global-admin-church";
const REAUTH_WINDOW_SECONDS = 15 * 60;

export function hasRecentReauthentication(reauthenticatedAt: number | undefined, now = Math.floor(Date.now() / 1000)) {
  return typeof reauthenticatedAt === "number" && reauthenticatedAt >= now - REAUTH_WINDOW_SECONDS;
}

export function isActiveSelectedChurch(selectedChurchId: string | null, church: { id: string; status: "ACTIVE" | "SUSPENDED" } | null) {
  return Boolean(selectedChurchId && church?.id === selectedChurchId && church.status === "ACTIVE");
}

export function canReadSelectedSiteOverview(context: { user: { isPlatformAdmin: boolean }; church: { id: string; status: string } | null }) {
  return context.user.isPlatformAdmin && context.church?.status === "ACTIVE";
}

export function buildGlobalAuditDetails(input: { churchId: string; targetType: string; targetId?: string; metadata?: Record<string, unknown> }) {
  return JSON.stringify({ boundary: GLOBAL_ADMIN_BOUNDARY, selectedChurchId: input.churchId, targetType: input.targetType, targetId: input.targetId ?? null, metadata: input.metadata ?? {} });
}

export function isGlobalAdminSession(session: { user?: { authBoundary?: string; mfaPending?: boolean } } | null) {
  return session?.user?.authBoundary === GLOBAL_ADMIN_BOUNDARY && session.user.mfaPending !== true;
}

export async function requireGlobalAdmin(options: { selectedChurch?: boolean; sensitive?: boolean } = {}) {
  const session = await getServerSession(authOptions);
  if (!session || !isGlobalAdminSession(session) || !session.user?.id) throw new Error("Unauthorized: bridge access is required.");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, isActive: true, isPlatformAdmin: true } });
  if (!user?.isActive || !user.isPlatformAdmin) throw new Error("Unauthorized: platform administrator access is required.");
  if (options.sensitive) {
    const reauthenticatedAt = session.user.reauthenticatedAt ?? 0;
    if (!hasRecentReauthentication(reauthenticatedAt)) throw new Error("Reauthentication required.");
  }
  const churchId = cookies().get(SELECTED_CHURCH_COOKIE)?.value ?? null;
  const church = churchId ? await db.church.findFirst({ where: { id: churchId, status: "ACTIVE" }, select: { id: true, name: true, slug: true } }) : null;
  if (options.selectedChurch && !church) throw new Error("A site must be selected before continuing.");
  return { user, church };
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
