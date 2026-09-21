import type { Permission } from "@prisma/client";
import { getCurrentUser, hasPermission, type User } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";

export async function authorizeVolunteerScheduling(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: a server-side authenticated session is required.");

  const permission: Permission = await hasPermission(user.id, "MANAGE_EVENTS")
    ? "MANAGE_EVENTS"
    : "MANAGE_MEMBERSHIP";
  const moduleSlug = permission === "MANAGE_EVENTS" ? "events" : "membership";
  await requireEnabledModule(moduleSlug, user.id, permission);
  if (!(await hasPermission(user.id, permission))) throw new Error("Unauthorized: required permission is missing.");
  return user;
}
