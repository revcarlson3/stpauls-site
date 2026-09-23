import { requireGlobalAdmin } from "@/lib/global-admin";
import Health from "./health";
export default async function GlobalAdminHealthPage() { await requireGlobalAdmin(); return <Health />; }
