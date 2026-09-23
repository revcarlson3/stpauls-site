import { NextResponse } from "next/server";
import { deleteSelectedChurchDomain } from "@/lib/global-admin-domains";
export async function POST(_request: Request, { params }: { params: { id: string } }) { try { return NextResponse.json(await deleteSelectedChurchDomain(params.id)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete domain." }, { status: 400 }); } }
