import { requireGlobalAdmin } from "@/lib/global-admin";
import GlobalAdminOperations from "./operations";

export default async function GlobalAdminOperationsPage() {
  await requireGlobalAdmin();
  return <GlobalAdminOperations />;
}
