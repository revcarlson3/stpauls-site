import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { claimDueRuns, deliverRun } from "@/lib/report-automations";

export async function POST(request: Request) {
  const secret = process.env.REPORT_AUTOMATION_CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const valid = Boolean(secret) && authorization.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
  if (!valid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const claimed = await claimDueRuns();
  for (const run of claimed) await deliverRun(run.runId);
  return NextResponse.json({ claimed: claimed.length });
}
