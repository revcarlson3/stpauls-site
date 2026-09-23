import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function POST(request: Request) {
  const body = await request.text();
  let event: { event_type?: string; resource?: { id?: string; custom_id?: string } };
  try { event = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid PayPal webhook payload." }, { status: 400 }); }
  const tokenResponse = await fetch(`${process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com"}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID || ""}:${process.env.PAYPAL_CLIENT_SECRET || ""}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!process.env.PAYPAL_WEBHOOK_ID || typeof token.access_token !== "string") return NextResponse.json({ error: "PayPal webhook verification is not configured." }, { status: 503 });
  const verify = await fetch(`${process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com"}/v1/notifications/verify-webhook-signature`, { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ auth_algo: request.headers.get("paypal-auth-algo"), cert_url: request.headers.get("paypal-cert-url"), transmission_id: request.headers.get("paypal-transmission-id"), transmission_sig: request.headers.get("paypal-transmission-sig"), transmission_time: request.headers.get("paypal-transmission-time"), webhook_id: process.env.PAYPAL_WEBHOOK_ID, webhook_event: JSON.parse(body) }) });
  const result = await verify.json().catch(() => ({}));
  if (!verify.ok || result.verification_status !== "SUCCESS") return NextResponse.json({ error: "Invalid PayPal webhook signature." }, { status: 400 });
  const localId = event.resource?.custom_id; const externalId = event.resource?.id;
  if (localId && externalId) await db.subscription.update({ where: { id: localId }, data: { externalSubscriptionId: externalId, status: event.event_type?.includes("ACTIVATED") || event.event_type?.includes("PAYMENT.SALE.COMPLETED") ? "ACTIVE" : event.event_type?.includes("CANCEL") ? "CANCELED" : "PAST_DUE" } });
  return NextResponse.json({ received: true });
}
