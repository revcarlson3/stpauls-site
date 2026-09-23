import { NextResponse } from "next/server";
import { requireGlobalAdmin } from "@/lib/global-admin";
import { getGlobalBillingOverview } from "@/lib/global-admin-billing";

export async function GET(request: Request) {
  try {
    await requireGlobalAdmin();
    const params = new URL(request.url).searchParams;
    return NextResponse.json(await getGlobalBillingOverview({ search: params.get("search") ?? undefined, status: params.get("status") ?? undefined, plan: params.get("plan") ?? undefined, provider: params.get("provider") ?? undefined, page: Number(params.get("page") ?? 1) }));
  }
  catch (error) { if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Global administrator access is required." }, { status: 403 }); return NextResponse.json({ error: "Unable to load billing overview." }, { status: 500 }); }
}
