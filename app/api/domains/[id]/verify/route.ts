import { NextResponse } from "next/server";
import { verifyTenantDomain } from "@/lib/domain-provider";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json({ domain: await verifyTenantDomain(params.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify domain." }, { status: 400 });
  }
}
