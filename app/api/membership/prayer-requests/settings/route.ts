import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

function validEmail(value: unknown) {
  return typeof value === "string" && (value.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()));
}

export async function GET() {
  try {
    await requirePermission("MANAGE_MEMBERSHIP");
    const settings = await db.securitySettings.findUnique({
      where: { id: 1 },
      select: { prayerRequestsSundayEmail: true, prayerRequestsEldersEmail: true }
    });
    return NextResponse.json({
      sundayEmail: settings?.prayerRequestsSundayEmail ?? "",
      eldersEmail: settings?.prayerRequestsEldersEmail ?? ""
    });
  } catch {
    return NextResponse.json({ error: "Unable to load prayer notification settings." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePermission("MANAGE_MEMBERSHIP");
    const input = await request.json().catch(() => null);
    if (!validEmail(input?.sundayEmail) || !validEmail(input?.eldersEmail)) {
      return NextResponse.json({ error: "Enter a valid email address or leave the field blank." }, { status: 400 });
    }
    const settings = await db.securitySettings.upsert({
      where: { id: 1 },
      update: {
        prayerRequestsSundayEmail: input.sundayEmail.trim() || null,
        prayerRequestsEldersEmail: input.eldersEmail.trim() || null
      },
      create: {
        id: 1,
        prayerRequestsSundayEmail: input.sundayEmail.trim() || null,
        prayerRequestsEldersEmail: input.eldersEmail.trim() || null
      },
      select: { prayerRequestsSundayEmail: true, prayerRequestsEldersEmail: true }
    });
    return NextResponse.json({
      sundayEmail: settings.prayerRequestsSundayEmail ?? "",
      eldersEmail: settings.prayerRequestsEldersEmail ?? ""
    });
  } catch {
    return NextResponse.json({ error: "Unable to save prayer notification settings." }, { status: 500 });
  }
}
