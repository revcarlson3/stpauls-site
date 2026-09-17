import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ensureAccountingFoundation } from "@/lib/accounting";
import { encryptAccountingAccountNumber } from "@/lib/accounting-secrets";

const TYPES = ["CHECKING", "SAVINGS", "PETTY_CASH", "CASH", "GIFT_CARD"] as const;

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  const { church } = await requireCurrentChurch();
  await ensureAccountingFoundation(church.id);
  return church;
}

export async function GET() {
  try {
    const church = await authorize();
    const accounts = await db.accountingBankAccount.findMany({
      where: { churchId: church.id },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, institution: true, lastFour: true, openingBalance: true, isActive: true, createdAt: true }
    });
    return NextResponse.json({ accounts });
  } catch {
    return NextResponse.json({ error: "Unable to load bank and cash accounts." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const church = await authorize();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim().slice(0, 120) : "";
    const type = typeof input?.type === "string" ? input.type.trim().toUpperCase() : "";
    const accountNumber = typeof input?.accountNumber === "string" ? input.accountNumber.replace(/\s+/g, "").slice(0, 40) : "";
    const institution = typeof input?.institution === "string" ? input.institution.trim().slice(0, 120) : null;
    const openingBalance = Number(input?.openingBalance);
    if (!name || !TYPES.includes(type as typeof TYPES[number]) || !Number.isFinite(openingBalance) || openingBalance < -1000000000 || openingBalance > 1000000000) {
      return NextResponse.json({ error: "Enter a name, account type, and valid beginning balance." }, { status: 400 });
    }
    if (type !== "PETTY_CASH" && type !== "CASH" && type !== "GIFT_CARD" && (!accountNumber || !/^[0-9A-Za-z-]+$/.test(accountNumber))) {
      return NextResponse.json({ error: "Enter the bank account number for this account." }, { status: 400 });
    }
    const account = await db.accountingBankAccount.create({
      data: {
        churchId: church.id,
        name,
        type,
        institution: institution || null,
        accountNumberEncrypted: accountNumber ? encryptAccountingAccountNumber(accountNumber) : null,
        lastFour: accountNumber ? accountNumber.slice(-4) : null,
        openingBalance: openingBalance.toFixed(2)
      },
      select: { id: true, name: true, type: true, institution: true, lastFour: true, openingBalance: true, isActive: true, createdAt: true }
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create bank and cash account." }, { status: 400 });
  }
}
