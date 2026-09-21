import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { accountTypeForCode, ensureAccountingFoundation, parentCodeForAccount, validateAccountCode } from "@/lib/accounting";

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  const { church } = await requireCurrentChurch();
  await ensureAccountingFoundation(church.id);
  return church;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const church = await authorize();
    const existing = await db.accountingAccount.findFirst({ where: { id: params.id, churchId: church.id } });
    if (!existing) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const input = await request.json();
    const code = typeof input?.code === "string" ? input.code.trim() : existing.code;
    const name = typeof input?.name === "string" ? input.name.trim().slice(0, 120) : existing.name;
    if (!validateAccountCode(code)) return NextResponse.json({ error: "Account code must be exactly five digits." }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Account name is required." }, { status: 400 });

    const duplicate = await db.accountingAccount.findFirst({ where: { churchId: church.id, code, NOT: { id: existing.id } }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: "That account code is already in use by this church." }, { status: 409 });

    const impliedType = accountTypeForCode(code);
    const type = impliedType ?? existing.type;
    const parentCode = parentCodeForAccount(code);
    const parent = parentCode ? await db.accountingAccount.findFirst({ where: { churchId: church.id, code: parentCode }, select: { id: true } }) : null;
    const requestedActive = typeof input?.isActive === "boolean" ? input.isActive : existing.isActive;
    if (!requestedActive && existing.isActive) {
      const accounts = await db.accountingAccount.findMany({ where: { churchId: church.id }, select: { id: true, parentId: true } });
      const descendantIds = new Set<string>([existing.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of accounts) {
          if (candidate.parentId && descendantIds.has(candidate.parentId) && !descendantIds.has(candidate.id)) {
            descendantIds.add(candidate.id);
            changed = true;
          }
        }
      }
      const journalLineCount = await db.accountingJournalEntryLine.count({ where: { accountId: { in: Array.from(descendantIds) } } });
      if (journalLineCount > 0) return NextResponse.json({ error: "This account cannot be disabled because it has journal lines. Historical accounts remain available for reporting." }, { status: 409 });
      await db.accountingAccount.updateMany({ where: { churchId: church.id, id: { in: Array.from(descendantIds) } }, data: { isActive: false } });
    } else if (requestedActive && !existing.isActive) {
      const accounts = await db.accountingAccount.findMany({ where: { churchId: church.id }, select: { id: true, parentId: true } });
      const descendantIds = new Set<string>([existing.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of accounts) {
          if (candidate.parentId && descendantIds.has(candidate.parentId) && !descendantIds.has(candidate.id)) {
            descendantIds.add(candidate.id);
            changed = true;
          }
        }
      }
      await db.accountingAccount.updateMany({ where: { churchId: church.id, id: { in: Array.from(descendantIds) } }, data: { isActive: true } });
    }

    const account = await db.accountingAccount.update({
      where: { id: existing.id },
      data: {
        code,
        name,
        type,
        parentId: parent?.id ?? (code === existing.code ? existing.parentId : null),
        isActive: requestedActive,
        ...(typeof input?.description === "string" ? { description: input.description.trim().slice(0, 500) || null } : {})
      }
    });
    return NextResponse.json({ account });
  } catch { return NextResponse.json({ error: "Unable to update account." }, { status: 400 }); }
}
