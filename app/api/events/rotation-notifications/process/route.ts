import { apiErrorResponse } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireTenantScope } from "@/lib/tenant";
import { processDueVolunteerNotifications } from "@/lib/event-volunteer-notifications";

export async function POST() {
  try {
    const user = await requirePermission("MANAGE_EVENTS");
    await requireEnabledModule("events", user.id, "MANAGE_EVENTS");
    const scope = await requireTenantScope();
    return NextResponse.json(await processDueVolunteerNotifications(scope.church.id));
  } catch (error) {
    return apiErrorResponse(error, "Unable to process volunteer notifications.");
  }
}
