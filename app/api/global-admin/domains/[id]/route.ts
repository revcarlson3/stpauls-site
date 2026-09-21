import { NextResponse } from "next/server";
import { disableSelectedChurchDomain } from "@/lib/global-admin-domains";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json({ domain: await disableSelectedChurchDomain(params.id) });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Bridge access is required." }, { status: 403 });
    if (error instanceof Error && error.message.includes("not found")) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof Error && error.message.includes("lifecycle")) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to disable domain." }, { status: 500 });
  }
}
