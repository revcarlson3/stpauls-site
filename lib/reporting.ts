import type { Permission } from "@prisma/client";
import { requirePermission, type User } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";
import { MEMBERSHIP_REPORT_TYPES, type MembershipReportType } from "@/lib/membership-reporting";
import { EVENT_REPORT_TYPES, type EventReportType } from "@/lib/event-reporting";
import { ACCOUNTING_REPORT_TYPES, type AccountingReportType } from "@/lib/accounting-reporting";
import { GIVING_REPORT_TYPES, type GivingReportType } from "@/lib/giving-reporting";

export type ReportModule = "membership" | "events" | "accounting" | "giving";
export type ReportTenantScope = "CURRENT_TENANT" | "PLATFORM_ADMIN_CROSS_TENANT";
export type ReportType = MembershipReportType | EventReportType | AccountingReportType | GivingReportType;

export type ReportDefinition = {
  key: `${ReportModule}:${string}`;
  module: ReportModule;
  reportType: ReportType;
  label: string;
  description: string;
  permission: Permission;
  enabledModule: ReportModule;
  tenantScope: ReportTenantScope;
};

type ReportTypeEntry = { value: string; label: string; description?: string };

const adapterDefinitions: Array<{
  module: ReportModule;
  permission: Permission;
  types: readonly ReportTypeEntry[];
}> = [
  { module: "membership", permission: "MANAGE_MEMBERSHIP", types: MEMBERSHIP_REPORT_TYPES },
  { module: "events", permission: "MANAGE_EVENTS", types: EVENT_REPORT_TYPES },
  { module: "accounting", permission: "MANAGE_ACCOUNTING", types: ACCOUNTING_REPORT_TYPES },
  { module: "giving", permission: "MANAGE_GIVING", types: GIVING_REPORT_TYPES }
];

/** The single source of truth used by a future global Reports page and report APIs. */
export const REPORT_DEFINITIONS: readonly ReportDefinition[] = adapterDefinitions.flatMap((adapter) =>
  adapter.types.map((type) => ({
    key: `${adapter.module}:${type.value}` as `${ReportModule}:${string}`,
    module: adapter.module,
    reportType: type.value as ReportType,
    label: type.label,
    description: type.description ?? `${type.label} for the ${adapter.module} module.`,
    permission: adapter.permission,
    enabledModule: adapter.module,
    tenantScope: "PLATFORM_ADMIN_CROSS_TENANT" as const
  }))
);

export function getReportDefinition(module: ReportModule, reportType: string) {
  return REPORT_DEFINITIONS.find((definition) => definition.module === module && definition.reportType === reportType);
}

export function getReportDefinitionByKey(key: string) {
  return REPORT_DEFINITIONS.find((definition) => definition.key === key);
}

export function listReportDefinitions(module?: ReportModule) {
  return module ? REPORT_DEFINITIONS.filter((definition) => definition.module === module) : [...REPORT_DEFINITIONS];
}

export type ReportExecutionScope = {
  user: User;
  churchId: string;
  isCrossTenant: boolean;
};

const modulePermissions: Record<ReportModule, Permission> = {
  membership: "MANAGE_MEMBERSHIP",
  events: "MANAGE_EVENTS",
  accounting: "MANAGE_ACCOUNTING",
  giving: "MANAGE_GIVING"
};

export async function authorizeReportModule(input: {
  module: ReportModule;
  churchId?: string;
}): Promise<ReportExecutionScope> {
  const user = await requirePermission(modulePermissions[input.module]);
  await requireEnabledModule(input.module, user.id, modulePermissions[input.module]);
  const scope = await requireTenantScope(input.churchId);
  return { user, churchId: scope.church.id, isCrossTenant: scope.isCrossTenant };
}

/**
 * Authorizes a report without ever allowing a caller to turn a tenant id into
 * an authorization decision. A non-platform administrator is always pinned to
 * the active church in their session.
 */
export async function authorizeReportExecution(input: {
  module: ReportModule;
  reportType: string;
  churchId?: string;
}): Promise<ReportExecutionScope> {
  const definition = getReportDefinition(input.module, input.reportType);
  if (!definition) throw new Error("Unknown report type.");

  const scope = await authorizeReportModule({ module: input.module, churchId: input.churchId });
  const user = scope.user;
  if (scope.isCrossTenant && (!user.isPlatformAdmin || definition.tenantScope !== "PLATFORM_ADMIN_CROSS_TENANT")) {
    throw new Error("Cross-tenant report access requires platform administrator access.");
  }
  return { user, churchId: scope.churchId, isCrossTenant: scope.isCrossTenant };
}

export const requireReportExecution = authorizeReportExecution;
