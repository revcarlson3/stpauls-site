import { NextResponse } from "next/server";
import { initiateBillingSubscription } from "@/lib/billing";
export async function POST(request: Request) {
  try { return NextResponse.json({ subscription: await initiateBillingSubscription(await request.json().catch(() => ({}))) }, { status: 202 }); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start billing.";
    const status = message.startsWith("Unauthorized:") ? 403 : message.includes("not configured") ? 503 : message.includes("Unsupported") || message.includes("required") || message.includes("unavailable") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
