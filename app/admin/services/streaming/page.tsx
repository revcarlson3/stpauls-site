import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { ServicesModulePage } from "../services-module-page";

export default async function StreamingPage() {
  const user = await requirePermission("MANAGE_SERVICES");
  await requireEnabledModule("services", user.id, "MANAGE_SERVICES");
  return <ServicesModulePage title="Streaming" description="Configure livestream destinations and manage online worship broadcasts." />;
}
