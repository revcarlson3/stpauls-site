import { NextResponse } from "next/server";
import { requestDomainAcquisition } from "@/lib/domain-provider";

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    if (typeof input.hostname !== "string" || !["REGISTRATION", "TRANSFER"].includes(input.operation) || typeof input.idempotencyKey !== "string" || !input.idempotencyKey.trim()) return NextResponse.json({ error: "Invalid domain request." }, { status: 400 });
    return NextResponse.json(await requestDomainAcquisition({ hostname: input.hostname, operation: input.operation, idempotencyKey: input.idempotencyKey }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create domain request." }, { status: 400 });
  }
}
