import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { processDueVolunteerNotifications } from "@/lib/event-volunteer-notifications";

function hasValidWorkerSecret(request: Request) {
  const secret = process.env.VOLUNTEER_NOTIFICATION_WORKER_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  return Boolean(secret) && authorization.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

export async function POST(request: Request) {
  if (!hasValidWorkerSecret(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json(await processDueVolunteerNotifications());
  } catch {
    return NextResponse.json({ error: "Unable to process volunteer notifications." }, { status: 500 });
  }
}
