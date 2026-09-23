import { NextResponse } from "next/server";
import { applyVerifiedStripeEvent, verifyStripeSignature } from "@/lib/billing-providers";
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret || !verifyStripeSignature(body, signature, secret)) return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  try { await applyVerifiedStripeEvent(JSON.parse(body)); return NextResponse.json({ received: true }); } catch { return NextResponse.json({ error: "Unable to process Stripe webhook." }, { status: 500 }); }
}
