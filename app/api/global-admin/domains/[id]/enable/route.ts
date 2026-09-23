import { NextResponse } from "next/server";
import { enableSelectedChurchDomain } from "@/lib/global-admin-domains";
export async function POST(_request: Request, { params }: { params: { id: string } }) { try { return NextResponse.json({ domain: await enableSelectedChurchDomain(params.id) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to enable domain." }, { status: 400 }); } }
