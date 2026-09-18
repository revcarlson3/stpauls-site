import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { requireCurrentChurch } from "@/lib/tenant";
import { ensureAccountingFoundation } from "@/lib/accounting";
import { buildEntry } from "@/lib/accounting-register";
import { notifyAccountingManagers } from "@/lib/giving-notifications";

const PAYMENT_TYPES = [
  "CASH",
  "CHECK",
  "CARD",
  "ACH",
  "TEXT",
  "OTHER",
] as const;

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_GIVING");
    await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
    const { church } = await requireCurrentChurch();
    const search =
      new URL(request.url).searchParams.get("search")?.trim() ?? "";
    const batchId =
      new URL(request.url).searchParams.get("batchId")?.trim() ?? "";
    const [batches, categories, bankAccounts, members, selectedBatch] =
      await Promise.all([
        db.givingContributionBatch.findMany({
          where: { churchId: church.id },
          orderBy: { batchDate: "desc" },
          take: 10,
          select: {
            id: true,
            batchDate: true,
            description: true,
            isPosted: true,
            depositStatus: true,
          },
        }),
        db.accountingAccount.findMany({
          where: {
            churchId: church.id,
            isActive: true,
            givingEnabled: true,
            OR: [
              { code: { startsWith: "4", not: "40000" } },
              { code: { startsWith: "6", not: "60000" } },
            ],
          },
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true },
        }),
        db.accountingBankAccount.findMany({
          where: { churchId: church.id, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        search.length >= 3 || /^\d+$/.test(search)
          ? db.membershipIndividual.findMany({
              where: {
                status: { not: "REMOVED" },
                OR: [
                  ...(search.length >= 3
                    ? [
                        {
                          lastName: {
                            contains: search,
                            mode: "insensitive" as const,
                          },
                        },
                        {
                          family: {
                            lastName: {
                              contains: search,
                              mode: "insensitive" as const,
                            },
                          },
                        },
                      ]
                    : []),
                  ...(search.length >= 1 && /^\d+$/.test(search)
                    ? [{ envelopeNumber: search }]
                    : []),
                ],
              },
              orderBy: [
                { family: { lastName: "asc" } },
                { lastName: "asc" },
                { firstName: "asc" },
              ],
              take: 20,
              select: {
                id: true,
                firstName: true,
                lastName: true,
                envelopeNumber: true,
                family: { select: { lastName: true } },
              },
            })
          : [],
        batchId
          ? db.givingContributionBatch.findFirst({
              where: { id: batchId, churchId: church.id },
              select: {
                id: true,
                batchDate: true,
                isPosted: true,
                contributions: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    memberId: true,
                    member: {
                      select: {
                        firstName: true,
                        lastName: true,
                        family: { select: { lastName: true } },
                        envelopeNumber: true,
                      },
                    },
                    amount: true,
                    categoryId: true,
                    deductible: true,
                    paymentType: true,
                    checkNumber: true,
                    memo: true,
                  },
                },
              },
            })
          : null,
      ]);
    return NextResponse.json({
      batches: batches.map((batch) => ({
        id: batch.id,
        date: batch.batchDate.toISOString(),
        description: batch.description,
        isPosted: batch.isPosted,
        depositStatus: batch.depositStatus,
      })),
      categories,
      bankAccounts,
      members: members.map((member) => ({
        id: member.id,
        name: `${member.lastName ?? member.family.lastName}, ${member.firstName}`,
        envelopeNumber: member.envelopeNumber,
      })),
      selectedBatch: selectedBatch
        ? {
            id: selectedBatch.id,
            date: selectedBatch.batchDate.toISOString(),
            isPosted: selectedBatch.isPosted,
            contributions: selectedBatch.contributions.map((row) => ({
              memberId: row.memberId ?? "",
              memberName: row.member
                ? `${row.member.lastName ?? row.member.family.lastName}, ${row.member.firstName}`
                : "",
              amount: String(row.amount),
              categoryId: row.categoryId,
              deductible: row.deductible,
              paymentType: row.paymentType,
              checkNumber: row.checkNumber ?? "",
              memo: row.memo ?? "",
            })),
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load contribution data." },
      { status: 403 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requirePermission("MANAGE_GIVING");
    await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
    const { church } = await requireCurrentChurch();
    const input = await request.json();
    if (input?.action === "post") {
      if (
        typeof input.batchId !== "string" ||
        typeof input.bankAccountId !== "string"
      )
        return NextResponse.json(
          { error: "A batch and bank account are required." },
          { status: 400 },
        );
      await ensureAccountingFoundation(church.id);
      const batch = await db.givingContributionBatch.findFirst({
        where: { id: input.batchId, churchId: church.id },
        select: {
          id: true,
          batchDate: true,
          description: true,
          isPosted: true,
          isLocked: true,
          depositStatus: true,
          contributions: {
            select: {
              amount: true,
              categoryId: true,
              category: { select: { givingFundId: true } },
            },
          },
        },
      });
      if (!batch)
        return NextResponse.json(
          { error: "Contribution batch not found." },
          { status: 404 },
        );
      if (batch.isPosted || batch.isLocked)
        return NextResponse.json(
          { error: "This batch has already been posted or locked." },
          { status: 409 },
        );
      if (!batch.contributions.length)
        return NextResponse.json(
          {
            error:
              "A batch must contain contributions before it can be posted.",
          },
          { status: 400 },
        );
      const allocations = new Map<
        string,
        { amount: number; fundId: string | null }
      >();
      for (const contribution of batch.contributions) {
        const current = allocations.get(contribution.categoryId);
        allocations.set(contribution.categoryId, {
          amount: (current?.amount ?? 0) + Number(contribution.amount),
          fundId: contribution.category.givingFundId,
        });
      }
      const amount = Array.from(allocations.values()).reduce(
        (total, value) => total + value.amount,
        0,
      );
      const description = batch.description?.trim() || "Contribution batch";
      const entry = await buildEntry(
        {
          date: batch.batchDate.toISOString().slice(0, 10),
          entryType: "STANDARD",
          bankAccountId: input.bankAccountId,
          transactionType: "CREDIT",
          paymentMethod: "DEP",
          amount,
          description,
          reference:
            typeof input.memo === "string"
              ? input.memo.trim().slice(0, 80)
              : "",
          allocations: Array.from(allocations, ([accountId, allocation]) => ({
            accountId,
            fundId: allocation.fundId,
            amount: allocation.amount,
          })),
        },
        church.id,
        { allowedParentAccountIds: new Set(allocations.keys()) },
      );
      if (!entry)
        return NextResponse.json(
          {
            error:
              "Unable to create the deposit with the selected bank account.",
          },
          { status: 400 },
        );
      await db.$transaction(async (transaction) => {
        const journalEntry = await transaction.accountingJournalEntry.create({
          data: {
            churchId: church.id,
            bankAccountId: entry.bankAccountId,
            transactionDate: entry.transactionDate,
            description: entry.description,
            reference: entry.reference || null,
            paymentMethod: entry.paymentMethod,
            transactionType: entry.transactionType || "CREDIT",
            entryType: entry.entryType,
            status: "PENDING",
            lines: { create: entry.lines },
          },
        });
        await transaction.givingContributionBatch.update({
          where: { id: batch.id },
          data: {
            isPosted: true,
            depositStatus: "PENDING",
            postedAt: new Date(),
            depositBankAccountId: input.bankAccountId,
            depositMemo:
              typeof input.memo === "string" ? input.memo.trim() || null : null,
            depositJournalEntryId: journalEntry.id,
          },
        });
      });
      await notifyAccountingManagers({
        senderId: user.id,
        title: "Contribution batch awaiting approval",
        message: `${batch.description || "Contribution batch"} was posted and is awaiting review and approval in the Accounting register.`,
        link: "/admin/accounting/register",
      });
      return NextResponse.json({ posted: true });
    }
    if (
      !input ||
      typeof input.batchId !== "string" ||
      typeof input.batchDate !== "string"
    )
      return NextResponse.json(
        { error: "A batch and date are required." },
        { status: 400 },
      );
    const batchDate = new Date(input.batchDate);
    const batch = await db.givingContributionBatch.findFirst({
      where: { id: input.batchId, churchId: church.id },
      select: { id: true, isPosted: true, isLocked: true },
    });
    if (!batch)
      return NextResponse.json(
        { error: "Contribution batch not found." },
        { status: 404 },
      );
    if (batch.isPosted || batch.isLocked)
      return NextResponse.json(
        { error: "Posted or locked batches cannot be edited." },
        { status: 409 },
      );
    if (Number.isNaN(batchDate.getTime()))
      return NextResponse.json(
        { error: "The batch date is invalid." },
        { status: 400 },
      );
    if (!Array.isArray(input.contributions)) {
      if (
        input.description !== undefined &&
        typeof input.description !== "string"
      )
        return NextResponse.json(
          { error: "The batch description is invalid." },
          { status: 400 },
        );
      await db.givingContributionBatch.update({
        where: { id: batch.id },
        data: {
          batchDate,
          description:
            typeof input.description === "string"
              ? input.description.trim() || null
              : undefined,
        },
      });
      return NextResponse.json({ saved: true });
    }
    if (!input.contributions.length)
      return NextResponse.json(
        { error: "At least one contribution is required." },
        { status: 400 },
      );
    const rows: Array<Record<string, unknown>> = input.contributions.filter(
      (row: unknown): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object",
    );
    if (
      !rows.length ||
      rows.some(
        (row) =>
          typeof row.amount !== "number" ||
          !Number.isFinite(row.amount) ||
          row.amount <= 0 ||
          typeof row.categoryId !== "string" ||
          !PAYMENT_TYPES.includes(
            String(row.paymentType) as (typeof PAYMENT_TYPES)[number],
          ) ||
          (row.paymentType === "CHECK" &&
            row.checkNumber !== undefined &&
            row.checkNumber !== null &&
            typeof row.checkNumber !== "string"),
      )
    )
      return NextResponse.json(
        {
          error:
            "Each contribution needs a valid amount, category, and payment type.",
        },
        { status: 400 },
      );
    const categoryIds = rows.map((row) => String(row.categoryId));
    const categories = await db.accountingAccount.findMany({
      where: {
        churchId: church.id,
        id: { in: categoryIds },
        givingEnabled: true,
        OR: [
          { code: { startsWith: "4", not: "40000" } },
          { code: { startsWith: "6", not: "60000" } },
        ],
        isActive: true,
      },
      select: { id: true },
    });
    if (categories.length !== new Set(categoryIds).size)
      return NextResponse.json(
        { error: "One or more contribution categories are invalid." },
        { status: 400 },
      );
    const memberIds = rows
      .map((row) => (typeof row.memberId === "string" ? row.memberId : ""))
      .filter(Boolean);
    if (
      memberIds.length &&
      (await db.membershipIndividual.count({
        where: { id: { in: memberIds }, status: { not: "REMOVED" } },
      })) !== new Set(memberIds).size
    )
      return NextResponse.json(
        { error: "One or more selected members are invalid." },
        { status: 400 },
      );
    await db.$transaction(async (transaction) => {
      await transaction.givingContribution.deleteMany({
        where: { batchId: batch.id },
      });
      await transaction.givingContributionBatch.update({
        where: { id: batch.id },
        data: {
          batchDate,
          contributions: {
            create: rows.map((row) => ({
              memberId: typeof row.memberId === "string" ? row.memberId : null,
              categoryId: String(row.categoryId),
              amount: row.amount as number,
              deductible: row.deductible !== false,
              paymentType: String(row.paymentType),
              checkNumber:
                row.paymentType === "CHECK" &&
                typeof row.checkNumber === "string"
                  ? row.checkNumber.trim() || null
                  : null,
              memo:
                typeof row.memo === "string" ? row.memo.trim() || null : null,
            })),
          },
        },
      });
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Giving contribution update failed", error);
    return NextResponse.json(
      { error: "Unable to update contribution batch." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requirePermission("MANAGE_GIVING");
    await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
    const { church } = await requireCurrentChurch();
    const input = await request.json();
    if (!input || typeof input.batchId !== "string" || !input.batchId.trim()) {
      return NextResponse.json(
        { error: "A contribution batch is required." },
        { status: 400 },
      );
    }
    const batch = await db.givingContributionBatch.findFirst({
      where: { id: input.batchId, churchId: church.id },
      select: { id: true, batchDate: true, description: true, depositJournalEntryId: true },
    });
    if (!batch) {
      return NextResponse.json(
        { error: "Contribution batch not found." },
        { status: 404 },
      );
    }
    const journalEntry = batch.depositJournalEntryId
      ? await db.accountingJournalEntry.findFirst({
          where: { id: batch.depositJournalEntryId, churchId: church.id },
          select: { id: true, status: true },
        })
      : null;
    await db.$transaction(async (transaction) => {
      if (journalEntry?.status === "PENDING") {
        await transaction.accountingJournalEntry.delete({
          where: { id: journalEntry.id },
        });
      } else if (journalEntry?.status === "POSTED") {
        await transaction.accountingJournalEntry.update({
          where: { id: journalEntry.id },
          data: {
            deletedGivingBatch: true,
            deletedGivingBatchAt: new Date(),
            deletedGivingBatchById: user.id,
          },
        });
      }
      await transaction.givingContributionBatch.delete({
        where: { id: batch.id },
      });
    });
    if (journalEntry?.status === "POSTED") {
      await notifyAccountingManagers({
        senderId: user.id,
        title: "Approved contribution batch deleted",
        message: `${user.name} deleted ${batch.description || "a contribution batch"} dated ${batch.batchDate.toLocaleDateString()}. Review the marked transaction in the Accounting register.`,
        link: "/admin/accounting/register",
      });
    }
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to delete contribution batch." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("MANAGE_GIVING");
    await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
    const { church } = await requireCurrentChurch();
    const input = await request.json();
    if (
      !input ||
      typeof input.batchDate !== "string" ||
      !Array.isArray(input.contributions) ||
      !input.contributions.length
    )
      return NextResponse.json(
        { error: "A batch date and at least one contribution are required." },
        { status: 400 },
      );
    const batchDate = new Date(input.batchDate);
    if (Number.isNaN(batchDate.getTime()))
      return NextResponse.json(
        { error: "The batch date is invalid." },
        { status: 400 },
      );
    const rows: Array<Record<string, unknown>> = input.contributions.filter(
      (row: unknown): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object",
    );
    if (
      !rows.length ||
      rows.some(
        (row) =>
          typeof row.amount !== "number" ||
          !Number.isFinite(row.amount) ||
          row.amount <= 0 ||
          typeof row.categoryId !== "string" ||
          !PAYMENT_TYPES.includes(
            String(row.paymentType) as (typeof PAYMENT_TYPES)[number],
          ) ||
          (row.paymentType === "CHECK" &&
            row.checkNumber !== undefined &&
            row.checkNumber !== null &&
            typeof row.checkNumber !== "string"),
      )
    )
      return NextResponse.json(
        {
          error:
            "Each contribution needs a valid amount, category, and payment type.",
        },
        { status: 400 },
      );
    const categoryIds = rows.map((row) => String(row.categoryId));
    const categories = await db.accountingAccount.findMany({
      where: {
        churchId: church.id,
        id: { in: categoryIds },
        givingEnabled: true,
        OR: [
          { code: { startsWith: "4", not: "40000" } },
          { code: { startsWith: "6", not: "60000" } },
        ],
        isActive: true,
      },
      select: { id: true },
    });
    if (categories.length !== new Set(categoryIds).size)
      return NextResponse.json(
        { error: "One or more contribution categories are invalid." },
        { status: 400 },
      );
    const memberIds = rows
      .map((row) => (typeof row.memberId === "string" ? row.memberId : ""))
      .filter(Boolean);
    if (
      memberIds.length &&
      (await db.membershipIndividual.count({
        where: { id: { in: memberIds }, status: { not: "REMOVED" } },
      })) !== new Set(memberIds).size
    )
      return NextResponse.json(
        { error: "One or more selected members are invalid." },
        { status: 400 },
      );
    const batch = await db.givingContributionBatch.create({
      data: {
        churchId: church.id,
        batchDate,
        contributions: {
          create: rows.map((row) => ({
            memberId: typeof row.memberId === "string" ? row.memberId : null,
            categoryId: String(row.categoryId),
            amount: row.amount as number,
            deductible: row.deductible !== false,
            paymentType: String(row.paymentType),
            checkNumber:
              row.paymentType === "CHECK" && typeof row.checkNumber === "string"
                ? row.checkNumber.trim() || null
                : null,
            memo: typeof row.memo === "string" ? row.memo.trim() || null : null,
          })),
        },
      },
      select: { id: true },
    });
    return NextResponse.json({ id: batch.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to save contribution batch." },
      { status: 500 },
    );
  }
}
