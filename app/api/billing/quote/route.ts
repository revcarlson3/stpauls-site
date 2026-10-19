import { NextResponse } from "next/server";
import { getBillingQuote } from "@/lib/billing";

export async function POST(request: Request) {
  try {
    return NextResponse.json({ quote: await getBillingQuote(await request.json().catch(() => ({}))) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare checkout.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Unauthorized:") ? 403 : 400 });
  }
}
