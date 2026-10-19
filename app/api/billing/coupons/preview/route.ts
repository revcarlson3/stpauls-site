import { NextResponse } from "next/server";
import { validateTenantCoupon } from "@/lib/billing-coupons";
export async function POST(request: Request) {
  try { return NextResponse.json({ preview: await validateTenantCoupon(await request.json().catch(() => ({}))) }); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to validate coupon."; return NextResponse.json({ error: message }, { status: message.startsWith("Unauthorized:") ? 403 : 400 }); }
}
