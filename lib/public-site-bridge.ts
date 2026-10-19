import { decode, encode } from "next-auth/jwt";
import type { Role } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessAdmin } from "@/lib/permissions";
import { normalizeRequestHost } from "@/lib/platform-host";

const BRIDGE_MAX_AGE_SECONDS = 60;
const PUBLIC_SESSION_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

type BridgeClaims = {
  purpose: "public-site-bridge";
  userId: string;
  churchId: string;
  hostname: string;
  role: Role;
  canAccessAdmin: boolean;
  sessionVersion: number;
};

function authSecret() {
  return process.env.NEXTAUTH_SECRET ?? "development-only-config-key";
}

export async function createPublicSiteBridgeToken(input: Omit<BridgeClaims, "purpose">) {
  return encode({
    token: { id: input.userId, ...input, purpose: "public-site-bridge" },
    secret: authSecret(),
    maxAge: BRIDGE_MAX_AGE_SECONDS
  });
}

export async function createPublicSiteSessionToken(token: string, requestHost: string | null) {
  const claims = await decode({ token, secret: authSecret() });
  if (!claims || claims.purpose !== "public-site-bridge" || typeof claims.userId !== "string" || typeof claims.churchId !== "string" || typeof claims.hostname !== "string" || claims.hostname !== normalizeRequestHost(requestHost)) return null;
  if (claims.role !== "viewer" && claims.role !== "editor" && claims.role !== "admin") return null;
  if (typeof claims.sessionVersion !== "number" || !Number.isInteger(claims.sessionVersion)) return null;

  const user = await db.user.findUnique({
    where: { id: claims.userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      sessionVersion: true,
      churchMemberships: {
        where: { churchId: claims.churchId, church: { status: "ACTIVE" } },
        take: 1,
        select: { churchId: true }
      },
      group: { select: { permissions: { select: { permission: true } } } }
    }
  });
  if (!user?.isActive || user.sessionVersion !== claims.sessionVersion || !user.churchMemberships.length || user.role !== claims.role) return null;

  const access = canAccessAdmin(user.group?.permissions.map(({ permission }) => permission) ?? []);
  if (!access || !claims.canAccessAdmin) return null;
  return encode({
    token: {
      id: user.id,
      role: user.role,
      canAccessAdmin: access,
      authBoundary: "tenant-admin",
      reauthenticatedAt: Math.floor(Date.now() / 1000),
      sessionVersion: user.sessionVersion
    },
    secret: authSecret(),
    maxAge: PUBLIC_SESSION_MAX_AGE_SECONDS
  });
}
