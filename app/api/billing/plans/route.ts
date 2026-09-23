import { NextResponse } from "next/server";
import { listAvailableBillingPlans } from "@/lib/billing";
export async function GET() {
  try { return NextResponse.json({ plans: await listAvailableBillingPlans() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load billing plans." }, { status: error instanceof Error && error.message.startsWith("Unauthorized:") ? 403 : 500 }); }
}
