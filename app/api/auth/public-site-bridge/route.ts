import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeRequestHost } from "@/lib/platform-host";
import { createPublicSiteBridgeToken } from "@/lib/public-site-bridge";

export async function GET(request: Request) {
  const targetValue = new URL(request.url).searchParams.get("target");
  let target: URL;
  try {
    target = new URL(targetValue ?? "");
  } catch {
    return NextResponse.json({ error: "The public site target is invalid." }, { status: 400 });
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return NextResponse.json({ error: "The public site target is invalid." }, { status: 400 });

  const user = await getCurrentUser();
  if (!user?.canAccessAdmin || !user.churchId) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const hostname = normalizeRequestHost(target.hostname);
  const domain = await db.siteDomain.findFirst({
    where: { churchId: user.churchId, hostname, status: "ACTIVE" },
    select: { hostname: true }
  });
  if (!domain) return NextResponse.json({ error: "The public site target is not available for this account." }, { status: 403 });

  const sessionVersion = (await db.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } }))?.sessionVersion;
  if (sessionVersion === undefined) return NextResponse.json({ error: "The account session is no longer available." }, { status: 401 });
  const bridgeToken = await createPublicSiteBridgeToken({
    userId: user.id,
    churchId: user.churchId,
    hostname,
    role: user.role,
    canAccessAdmin: user.canAccessAdmin,
    sessionVersion
  });
  const bridgeUrl = new URL("/auth/bridge", `${target.protocol}//${domain.hostname}`);
  bridgeUrl.searchParams.set("token", bridgeToken);
  return NextResponse.redirect(bridgeUrl);
}
