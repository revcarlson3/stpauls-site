import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireEnabledModule } from "@/lib/modules";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
    if (!user.permissions.includes("MY_MEMBERSHIP")) return NextResponse.json({ error: "Membership access is not enabled." }, { status: 403 });
    await requireEnabledModule("membership", user.id, "MY_MEMBERSHIP");
    const link = await db.membershipUserMemberLink.findUnique({
      where: { userId: user.id },
      select: { individual: { select: { familyId: true } } }
    });
    if (!link) return NextResponse.json({ linked: false, documents: [], forms: [] });
    const [documents, forms] = await Promise.all([
      db.membershipDocument.findMany({
        where: { familyId: link.individual.familyId, memberVisible: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        orderBy: { createdAt: "desc" },
        select: { id: true, originalName: true, category: true, description: true, mimeType: true, sizeBytes: true, expiresAt: true, createdAt: true }
      }),
      db.form.findMany({
        where: { enabled: true, status: "PUBLISHED", audience: { in: ["PUBLIC", "MEMBERS"] } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, slug: true, updatedAt: true }
      })
    ]);
    return NextResponse.json({
      linked: true,
      documents: documents.map((document) => ({ ...document, downloadUrl: `/api/membership/families/${link.individual.familyId}/documents/${document.id}` })),
      forms
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unauthorized:")) return NextResponse.json({ error: "Membership access is not enabled." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load member documents and forms." }, { status: 500 });
  }
}
