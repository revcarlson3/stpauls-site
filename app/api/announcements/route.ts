import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sanitizeAnnouncementHtml, sanitizeTickerHtml } from "@/lib/announcement-content";
import { resolvePublicTenant } from "@/lib/platform-domain";
import { normalizeRequestHost } from "@/lib/platform-host";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isPublic = url.searchParams.get("surface") === "public";
  const isAdminDashboard = url.searchParams.get("surface") === "admin-dashboard";
  const surface = isPublic ? "PUBLIC_TICKER" : isAdminDashboard ? "ADMIN_DASHBOARD" : "AUTHENTICATED";
  const user = await getCurrentUser();
  if (!isPublic && !user?.churchId) return NextResponse.json({ announcements: [] });
  const publicTenant = isPublic ? await resolvePublicTenant(normalizeRequestHost(request.headers.get("host"))) : null;
  const now = new Date();
  const announcements = await db.globalAnnouncement.findMany({
    where: {
      isActive: true,
      AND: [
        { startsAt: { lte: now } },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ...(isPublic
          ? [{ OR: [{ audience: "GLOBAL", placement: { in: ["PUBLIC_TICKER", "BOTH"] } }, ...(publicTenant ? [{ audience: "TENANT", churchId: publicTenant.id }] : [])] }]
          : [{ placement: { in: isAdminDashboard ? ["ADMIN_DASHBOARD"] : ["AUTHENTICATED", "BOTH"] } }, { OR: [{ audience: "GLOBAL", deliveries: { some: { churchId: user!.churchId! } } }, { audience: "TENANT", churchId: user!.churchId! }] }])
      ]
    },
    orderBy: [{ severity: "desc" }, { startsAt: "desc" }],
    take: 10,
    select: {
      id: true,
      title: true,
      body: true,
      severity: true,
      audience: true,
      placement: true,
      deliveries: user?.churchId ? { where: { churchId: user.churchId }, select: { acknowledgedAt: true } } : undefined
    }
  });
  return NextResponse.json({ announcements: announcements.map((announcement) => ({
    ...announcement,
    body: isAdminDashboard ? sanitizeAnnouncementHtml(announcement.body) : sanitizeTickerHtml(announcement.body),
    acknowledged: Boolean(announcement.deliveries?.[0]?.acknowledgedAt)
  })) });
}
