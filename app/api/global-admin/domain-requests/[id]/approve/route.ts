import { NextResponse } from "next/server";
import { approveDomainAcquisition } from "@/lib/domain-provider";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const input = await request.json().catch(() => ({}));
    if (typeof input.confirmationToken !== "string") return NextResponse.json({ error: "Approval confirmation is required." }, { status: 400 });
    return NextResponse.json({ request: await approveDomainAcquisition({ requestId: params.id, confirmationToken: input.confirmationToken, years: input.years, contacts: input.contacts, nameservers: input.nameservers, eppCode: input.eppCode }) });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve domain request." }, { status: 400 });
  }
}
