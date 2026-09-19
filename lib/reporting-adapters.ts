import {
  REPORT_DEFINITIONS,
  getReportDefinition,
  listReportDefinitions,
  type ReportDefinition,
  type ReportModule
} from "@/lib/reporting";

/**
 * Adapters intentionally expose metadata only. Existing specialized result
 * routes remain the execution implementations, including Treasurer and
 * Contribution Statement rendering.
 */
export type ReportingModuleAdapter = {
  module: ReportModule;
  definitions: readonly ReportDefinition[];
  getDefinition: (reportType: string) => ReportDefinition | undefined;
};

export const REPORTING_ADAPTERS: readonly ReportingModuleAdapter[] = ([
  "membership",
  "events",
  "accounting",
  "giving"
] as ReportModule[]).map((module) => ({
  module,
  definitions: listReportDefinitions(module),
  getDefinition: (reportType: string) => getReportDefinition(module, reportType)
}));

export function getReportingAdapter(module: ReportModule) {
  return REPORTING_ADAPTERS.find((adapter) => adapter.module === module);
}

export { REPORT_DEFINITIONS };
