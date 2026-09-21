import { NextResponse } from "next/server";
import { lifecycleActions, transitionSelectedChurchLifecycle } from "@/lib/global-admin";

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({}));
  const action = typeof input.action === "string" ? input.action : "";
  if (!lifecycleActions.includes(action as (typeof lifecycleActions)[number])) return NextResponse.json({ error: "Invalid lifecycle action." }, { status: 400 });
  try {
    return NextResponse.json({ church: await transitionSelectedChurchLifecycle(action as (typeof lifecycleActions)[number]) });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message.startsWith("Invalid lifecycle transition:")) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to change site lifecycle." }, { status: 500 });
  }
}
