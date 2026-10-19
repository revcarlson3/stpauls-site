import { NextResponse } from "next/server";
import { getExistingSubscriptionDomainAddonPricing, initiateExistingSubscriptionDomainAddon } from "@/lib/billing";
import { requestDomainAcquisition, searchDomainAvailability } from "@/lib/domain-provider";

export async function GET() {
  try {
    return NextResponse.json(await getExistingSubscriptionDomainAddonPricing());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load domain pricing." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    if (typeof input.hostname !== "string") return NextResponse.json({ error: "Provide a domain name." }, { status: 400 });
    const availability = (await searchDomainAvailability([input.hostname]))[0];
    if (!availability?.available) return NextResponse.json({ error: "That domain is not available." }, { status: 400 });
    const billing = await initiateExistingSubscriptionDomainAddon({ hostname: input.hostname, registrationPrice: availability.registrationPrice ? Number(availability.registrationPrice) : 0 });
    const requestResult = await requestDomainAcquisition({ hostname: input.hostname, operation: "REGISTRATION", idempotencyKey: `domain-addon-${billing.subscriptionId}` });
    return NextResponse.json({ billing, request: requestResult }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start domain purchase." }, { status: 400 });
  }
}
