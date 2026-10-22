import { NextResponse } from "next/server";
import { createTemplate, deleteTemplate } from "@/lib/announcement-publications";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await requirePermission("MANAGE_SETTINGS");
    if (!user.churchId) return NextResponse.json({ templates: [] });
    return NextResponse.json({ templates: await db.announcementTemplate.findMany({ where: { churchId: user.churchId }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, title: true, bodyHtml: true, documentJson: true, createdAt: true, updatedAt: true } }) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load templates." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json({ template: await createTemplate(await request.json()) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create template." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete template." }, { status: 400 });
  }
}
