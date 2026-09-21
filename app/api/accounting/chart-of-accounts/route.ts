import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { accountTypeForCode, ACCOUNT_TYPES, ensureAccountingFoundation, parentCodeForAccount, validateAccountCode } from "@/lib/accounting";

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  const context = await requireCurrentChurch();
  await ensureAccountingFoundation(context.church.id);
  return context.church;
}

export async function GET() {
  try {
    const church = await authorize();
    const accounts = await db.accountingAccount.findMany({ where: { churchId: church.id }, orderBy: { code: "asc" } });
    return NextResponse.json({ accounts });
  } catch { return NextResponse.json({ error: "Unable to load chart of accounts." }, { status: 403 }); }
}

export async function POST(request: Request) {
  try {
    const church = await authorize();
    const input = await request.json();
    const code = typeof input?.code === "string" ? input.code.trim() : "";
    const name = typeof input?.name === "string" ? input.name.trim().slice(0, 120) : "";
    const requestedType = typeof input?.type === "string" ? input.type.trim().toUpperCase() : "";
    const type = requestedType || accountTypeForCode(code) || "EXPENSE";
    if (!validateAccountCode(code) || !name || !ACCOUNT_TYPES.includes(type as typeof ACCOUNT_TYPES[number])) return NextResponse.json({ error: "Code must be exactly five digits, name is required, and the account type must be valid." }, { status: 400 });
    const impliedType = accountTypeForCode(code);
    if (impliedType && impliedType !== type && !["8", "9"].includes(code[0])) return NextResponse.json({ error: `Account ${code} must use the ${impliedType.toLowerCase()} type.` }, { status: 400 });
    const duplicate = await db.accountingAccount.findFirst({ where: { churchId: church.id, code }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: "That account code is already in use by this church." }, { status: 409 });
    const requestedParentId = typeof input?.parentId === "string" ? input.parentId : null;
    const derivedParentCode = parentCodeForAccount(code);
    const derivedParent = derivedParentCode
      ? await db.accountingAccount.findFirst({ where: { churchId: church.id, code: derivedParentCode }, select: { id: true } })
      : null;
    const parentId = requestedParentId || derivedParent?.id || null;
    if (parentId && !(await db.accountingAccount.findFirst({ where: { id: parentId, churchId: church.id }, select: { id: true } }))) return NextResponse.json({ error: "The selected parent account was not found." }, { status: 400 });
    const account = await db.accountingAccount.create({ data: { churchId: church.id, code, name, type, parentId, description: typeof input?.description === "string" ? input.description.trim().slice(0, 500) : null } });
    return NextResponse.json({ account }, { status: 201 });
  } catch { return NextResponse.json({ error: "Unable to create account." }, { status: 400 }); }
}
