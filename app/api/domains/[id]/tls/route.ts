import { NextResponse } from "next/server";
import { retryTenantDomainTls } from "@/lib/domain-provider";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const domain = await retryTenantDomainTls(params.id);
    if (domain.tlsStatus === "FAILED") {
      return NextResponse.json({ domain, error: "SSL setup could not be completed. Please contact support if retrying does not resolve the issue." }, { status: 502 });
    }
    return NextResponse.json({ domain });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to provision SSL." }, { status: 400 });
  }
}
