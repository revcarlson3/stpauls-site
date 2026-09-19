import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/tenant";
import { GET as downloadAttachment } from "@/app/api/support/attachments/[id]/route";

export async function GET(request: Request, context: { params: { id: string } }) {
  try { await requirePlatformAdmin(); return downloadAttachment(request, context); }
  catch { return NextResponse.json({ error: "Platform administrator access is required." }, { status: 403 }); }
}
