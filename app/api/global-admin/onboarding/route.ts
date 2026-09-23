import { NextResponse } from "next/server";
import { getSelectedChurchOnboarding, listGlobalOnboarding, updateGlobalOnboarding, updateSelectedChurchOnboarding } from "@/lib/global-admin-onboarding";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    if (params.has("siteId") || params.has("search") || params.has("status") || params.has("page")) return NextResponse.json(await listGlobalOnboarding({ search: params.get("search") ?? undefined, status: params.get("status") ?? undefined, page: Number(params.get("page") ?? 1) }));
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
    return NextResponse.json({ onboarding: input.siteId ? await updateGlobalOnboarding(input) : await updateSelectedChurchOnboarding(input) });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message === "A site must be selected before continuing.") return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && (error.message.startsWith("Invalid") || error.message.startsWith("Complete") || error.message.startsWith("Onboarding") || error.message.includes("cleared"))) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to update onboarding." }, { status: 500 });
  }
}
