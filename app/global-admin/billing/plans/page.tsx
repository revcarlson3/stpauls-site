import { requireGlobalAdmin } from "@/lib/global-admin";
import PlansWorkspace from "./workspace";
export default async function GlobalAdminPlansPage() { await requireGlobalAdmin(); return <PlansWorkspace />; }
