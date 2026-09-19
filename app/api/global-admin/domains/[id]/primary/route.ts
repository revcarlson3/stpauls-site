import { NextResponse } from "next/server";
import { selectPrimarySelectedChurchDomain } from "@/lib/global-admin-domains";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json({ domain: await selectPrimarySelectedChurchDomain(params.id) });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message.includes("not found")) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof Error && (error.message.includes("lifecycle") || error.message.includes("active domain"))) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to select the primary domain." }, { status: 500 });
  }
}
