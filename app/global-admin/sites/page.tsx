import { requireGlobalAdmin } from "@/lib/global-admin";
import Sites from "./sites";
export default async function GlobalAdminSitesPage() { await requireGlobalAdmin(); return <Sites />; }
