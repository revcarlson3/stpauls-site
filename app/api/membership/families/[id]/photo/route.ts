import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";

const mimeTypes = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"]
]);

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const family = await db.membershipFamily.findUnique({ where: { id: params.id }, select: { photographUrl: true } });
    const requested = new URL(request.url).searchParams.get("file");
    if (!family?.photographUrl || !requested || family.photographUrl !== `/api/membership/families/${params.id}/photo?file=${encodeURIComponent(requested)}` || !/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/.test(requested)) {
      return NextResponse.json({ error: "Family photograph not found." }, { status: 404 });
    }
    const file = await readFile(path.join(process.cwd(), "storage", "membership", requested));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": mimeTypes.get(requested.split(".").pop()?.toLowerCase() ?? "") ?? "application/octet-stream",
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to load family photograph." }, { status: 404 });
  }
}
