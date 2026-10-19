import { NextResponse } from "next/server";
import { retryTenantDomainTls } from "@/lib/domain-provider";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json({ domain: await retryTenantDomainTls(params.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to provision SSL." }, { status: 400 });
  }
}
