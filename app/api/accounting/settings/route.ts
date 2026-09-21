import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ensureAccountingFoundation } from "@/lib/accounting";

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  return requireCurrentChurch();
}

export async function GET() {
  try {
    const { church } = await authorize();
    const settings = await ensureAccountingFoundation(church.id);
    return NextResponse.json({ settings });
  } catch { return NextResponse.json({ error: "Unable to load accounting settings." }, { status: 403 }); }
}

export async function PUT(request: Request) {
  try {
    const { church } = await authorize();
    const input = await request.json();
    const month = Number(input?.fiscalYearStartMonth);
    const day = Number(input?.fiscalYearStartDay);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
      return NextResponse.json({ error: "Fiscal year start must be a valid month and day." }, { status: 400 });
    }
    const currency = typeof input?.currency === "string" && /^[A-Z]{3}$/.test(input.currency.trim().toUpperCase()) ? input.currency.trim().toUpperCase() : "USD";
    const settings = await db.accountingSettings.upsert({ where: { churchId: church.id }, update: { fiscalYearStartMonth: month, fiscalYearStartDay: day, currency }, create: { churchId: church.id, fiscalYearStartMonth: month, fiscalYearStartDay: day, currency } });
    return NextResponse.json({ settings });
  } catch { return NextResponse.json({ error: "Unable to save accounting settings." }, { status: 400 }); }
}
