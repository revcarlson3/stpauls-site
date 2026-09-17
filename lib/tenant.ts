import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function requireCurrentChurch() {
  const user = await getCurrentUser();
  if (!user?.churchId) throw new Error("The authenticated user is not assigned to an active church.");
  const church = await db.church.findUnique({ where: { id: user.churchId } });
  if (!church || church.status !== "ACTIVE") throw new Error("The current church is unavailable.");
  return { user, church };
}

export async function requirePlatformAdmin() {
  const user = await getCurrentUser();
  if (!user?.isPlatformAdmin) throw new Error("Platform administrator access is required.");
  return user;
}
