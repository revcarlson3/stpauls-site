import { NextResponse } from "next/server";
import { pollDomainTransfer } from "@/lib/domain-provider";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json({ request: await pollDomainTransfer(params.id) });
  } catch (error) {
    if (error instanceof Error && error.message === "Reauthentication required.") return NextResponse.json({ error: error.message }, { status: 428 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to poll transfer status." }, { status: 400 });
  }
}
