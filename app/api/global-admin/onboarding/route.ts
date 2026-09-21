import { NextResponse } from "next/server";
import { getSelectedChurchOnboarding, updateSelectedChurchOnboarding } from "@/lib/global-admin-onboarding";

export async function GET() {
  try {
    return NextResponse.json({ onboarding: await getSelectedChurchOnboarding() });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to load onboarding." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const input = await request.json().catch(() => ({}));
  try {
    return NextResponse.json({ onboarding: await updateSelectedChurchOnboarding(input) });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && (error.message.startsWith("Invalid") || error.message.startsWith("Complete") || error.message.startsWith("Onboarding") || error.message.includes("cleared"))) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to update onboarding." }, { status: 500 });
  }
}
