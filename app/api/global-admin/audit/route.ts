import { NextRequest, NextResponse } from "next/server";
import { requireGlobalAdmin } from "@/lib/global-admin";
import { auditActivityTypes } from "@/lib/audit";
import { getGlobalAdminAudit } from "@/lib/global-admin-audit";

export async function GET(request: NextRequest) {
  try {
    await requireGlobalAdmin();
    const params = request.nextUrl.searchParams;
    const result = await getGlobalAdminAudit({
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 25),
      activityType: params.get("activityType") ?? undefined,
      churchId: params.get("churchId") ?? undefined,
      actor: params.get("actor") ?? undefined,
      search: params.get("search") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined
    });
    return NextResponse.json({ ...result, activityTypes: auditActivityTypes });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Global administrator access is required." }, { status: 403 });
    console.error("Global admin audit could not be loaded.", error);
    return NextResponse.json({ error: "Unable to load audit activity." }, { status: 500 });
  }
}
