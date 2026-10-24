import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { ServicesModulePage } from "./services-module-page";

export default async function ServicesPage() {
  const user = await requirePermission("MANAGE_SERVICES");
  await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
  return <ServicesModulePage title="Sermons" description="Manage sermons, service recordings, and published worship content." />;
}
