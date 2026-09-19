import { requireGlobalAdmin } from "@/lib/global-admin";
import GlobalAdminControlPlane from "./control-plane";

export default async function GlobalAdminPage() {
  await requireGlobalAdmin();
  return <GlobalAdminControlPlane />;
}
