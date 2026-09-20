export const SYSTEM_SECURITY_GROUP_SLUGS = ["visitor", "church-member", "editor", "administrator"] as const;
export const IMMUTABLE_PERMISSION_GROUP_SLUGS = ["visitor", "administrator"] as const;

export function isSystemSecurityGroup(slug: string) {
  return SYSTEM_SECURITY_GROUP_SLUGS.includes(slug as (typeof SYSTEM_SECURITY_GROUP_SLUGS)[number]);
}

export function canEditSecurityGroupPermissions(slug: string) {
  return !IMMUTABLE_PERMISSION_GROUP_SLUGS.includes(slug as (typeof IMMUTABLE_PERMISSION_GROUP_SLUGS)[number]);
}

export function canRenameSecurityGroup(slug: string) {
  return !isSystemSecurityGroup(slug);
}
