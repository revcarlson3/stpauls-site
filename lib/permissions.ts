import type { Permission } from "@prisma/client";

export function canAccessAdmin(permissions: readonly Permission[]) {
  return permissions.some((permission) => permission !== "MY_MEMBERSHIP");
}

export function hasEffectivePermission(permissions: readonly Permission[], permission: Permission) {
  return permissions.includes(permission);
}
