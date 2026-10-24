import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { ServicesModulePage } from "../services-module-page";

export default async function ServicesSettingsPage() {
  const user = await requirePermission("MANAGE_SERVICES");
  await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
  return <ServicesModulePage title="Settings" description="Configure services and sermons module defaults, publishing, and integrations." />;
}
