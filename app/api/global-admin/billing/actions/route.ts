import { NextResponse } from "next/server";
import { executeGlobalBillingAction } from "@/lib/global-admin-billing-actions";
export async function POST(request: Request) {
  const input = await request.json().catch(() => ({}));
  try { return NextResponse.json({ action: await executeGlobalBillingAction(input.subscriptionId, input.action, input.confirm === true) }, { status: input.confirm === true ? 200 : 200 }); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply billing action.";
    const status = message.startsWith("Unauthorized:") ? 403 : message === "Reauthentication required." ? 428 : message.includes("unavailable") || message.includes("not available") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
