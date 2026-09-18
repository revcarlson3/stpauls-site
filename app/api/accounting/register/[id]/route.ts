import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { requireCurrentChurch } from "@/lib/tenant";
import { db } from "@/lib/db";
import { ensureAccountingFoundation } from "@/lib/accounting";
import { buildEntry } from "@/lib/accounting-register";
import { ensureAccountingContact } from "@/lib/accounting-contacts";

async function authorize() {
  const user = await requirePermission("MANAGE_ACCOUNTING");
  await requireEnabledModule("accounting", user.id, "MANAGE_ACCOUNTING");
  const { church } = await requireCurrentChurch();
  await ensureAccountingFoundation(church.id);
  return church;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const church = await authorize();
    const existing = await db.accountingJournalEntry.findFirst({
      where: { id: params.id, churchId: church.id },
      select: {
        id: true,
        status: true,
        lines: { select: { accountId: true } },
      },
    });
    if (!existing)
      return NextResponse.json(
        { error: "Transaction not found." },
        { status: 404 },
      );
    const input = await request.json();
    if (input?.action === "approve") {
      if (existing.status !== "PENDING")
        return NextResponse.json(
          { error: "This transaction is not pending approval." },
          { status: 409 },
        );
      await db.$transaction(async (transaction) => {
        await transaction.accountingJournalEntry.update({
          where: { id: existing.id },
          data: { status: "POSTED" },
        });
        await transaction.givingContributionBatch.updateMany({
          where: { depositJournalEntryId: existing.id },
          data: { depositStatus: "POSTED" },
        });
      });
      return NextResponse.json({ approved: true });
    }
    const description = await ensureAccountingContact(church.id, input);
    if (description) input.description = description;
    const entry = await buildEntry(input, church.id, {
      allowedParentAccountIds: new Set(
        existing.lines.map((line) => line.accountId),
      ),
    });
    if (!entry)
      return NextResponse.json(
        { error: "Enter valid transaction or transfer details." },
        { status: 400 },
      );
    await db.accountingJournalEntry.update({
      where: { id: existing.id },
      data: {
        bankAccountId: entry.bankAccountId,
        transactionDate: entry.transactionDate,
        description: entry.description,
        reference: entry.reference || null,
        paymentMethod: entry.paymentMethod,
        transactionType: entry.transactionType || "CREDIT",
        entryType: entry.entryType,
        lines: { deleteMany: {}, create: entry.lines },
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to update the transaction." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const church = await authorize();
    const existing = await db.accountingJournalEntry.findFirst({
      where: { id: params.id, churchId: church.id },
      select: { id: true },
    });
    if (!existing)
      return NextResponse.json(
        { error: "Transaction not found." },
        { status: 404 },
      );
    await db.accountingJournalEntry.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to delete the transaction." },
      { status: 400 },
    );
  }
}
