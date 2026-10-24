import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { ServicesModulePage } from "../services-module-page";

export default async function ServicesSchedulePage() {
  const user = await requirePermission("MANAGE_SERVICES");
  await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
  return <ServicesModulePage title="Services" description="Manage worship services, schedules, and service details." />;
}
