import { NextResponse } from "next/server";
import { cancelCurrentBillingSubscription } from "@/lib/billing";

export async function POST() {
  try {
    return NextResponse.json(await cancelCurrentBillingSubscription());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel subscription.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Unauthorized:") ? 403 : 400 });
  }
}
