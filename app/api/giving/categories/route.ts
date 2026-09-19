import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { requireCurrentChurch } from "@/lib/tenant";

async function authorize() {
  const user = await requirePermission("MANAGE_GIVING");
  await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
  const { church } = await requireCurrentChurch();
  return church;
}

async function descendantIds(churchId: string, accountId: string) {
  const accounts = await db.accountingAccount.findMany({
    where: { churchId, ...categoryWhere },
    select: { id: true, code: true, parentId: true },
  });
  const byCode = new Map(accounts.map((account) => [account.code, account.id]));
  const descendants = new Set<string>([accountId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const account of accounts) {
      const parentId =
        account.parentId ??
        (parentCode(account.code)
          ? (byCode.get(parentCode(account.code)!) ?? null)
          : null);
      if (
        parentId &&
        descendants.has(parentId) &&
        !descendants.has(account.id)
      ) {
        descendants.add(account.id);
        changed = true;
      }
    }
  }
  return Array.from(descendants);
}

const categoryWhere = {
  OR: [{ code: { startsWith: "4" } }, { code: { startsWith: "6" } }],
};

function parentCode(code: string) {
  if (!/^\d{5}$/.test(code)) return null;
  if (code.slice(3) !== "00") return `${code.slice(0, 3)}00`;
  if (code.slice(2) !== "000") return `${code.slice(0, 2)}000`;
  if (code.slice(1) !== "0000") return `${code[0]}0000`;
  return null;
}

export async function GET() {
  try {
    const church = await authorize();
    const [accounts, funds] = await Promise.all([
      db.accountingAccount.findMany({
        where: { churchId: church.id, isActive: true, ...categoryWhere },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          parentId: true,
          givingEnabled: true,
          onlineGivingEnabled: true,
          givingFundId: true,
        },
      }),
      db.accountingFund.findMany({
        where: { churchId: church.id, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        select: { id: true, code: true, name: true },
      }),
    ]);
    return NextResponse.json({ accounts, funds });
  } catch {
    return NextResponse.json(
      { error: "Unable to load giving categories." },
      { status: 403 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const church = await authorize();
    const input = await request.json();
    if (!input || typeof input.accountId !== "string") {
      return NextResponse.json(
        { error: "A contribution category is required." },
        { status: 400 },
      );
    }
    const account = await db.accountingAccount.findFirst({
      where: {
        id: input.accountId,
        churchId: church.id,
        isActive: true,
        ...categoryWhere,
      },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Contribution category not found." },
        { status: 404 },
      );
    }
    const data: {
      givingEnabled?: boolean;
      onlineGivingEnabled?: boolean;
      givingFundId?: string | null;
    } = {};
    if (input.givingEnabled !== undefined) {
      if (typeof input.givingEnabled !== "boolean") {
        return NextResponse.json(
          { error: "The category status is invalid." },
          { status: 400 },
        );
      }
      data.givingEnabled = input.givingEnabled;
    }
    if (input.onlineGivingEnabled !== undefined) {
      if (typeof input.onlineGivingEnabled !== "boolean") {
        return NextResponse.json(
          { error: "The online giving category status is invalid." },
          { status: 400 },
        );
      }
      data.onlineGivingEnabled = input.onlineGivingEnabled;
    }
    if (input.givingFundId !== undefined) {
      if (
        input.givingFundId !== null &&
        typeof input.givingFundId !== "string"
      ) {
        return NextResponse.json(
          { error: "The selected fund is invalid." },
          { status: 400 },
        );
      }
      if (input.givingFundId) {
        const fund = await db.accountingFund.findFirst({
          where: {
            id: input.givingFundId,
            churchId: church.id,
            isActive: true,
          },
          select: { id: true },
        });
        if (!fund) {
          return NextResponse.json(
            { error: "The selected fund was not found." },
            { status: 400 },
          );
        }
      }
      data.givingFundId = input.givingFundId || null;
    }
    if (!Object.keys(data).length) {
      return NextResponse.json(
        { error: "No category changes were provided." },
        { status: 400 },
      );
    }
    const ids = await descendantIds(church.id, account.id);
    if (
      input.givingFundId !== undefined &&
      ids.length > 1
    ) {
      return NextResponse.json(
        {
          error:
            "Fund assignments and online giving are available only for categories without child categories.",
        },
        { status: 400 },
      );
    }
    const updated = await db.$transaction(async (transaction) => {
      if (input.givingFundId !== undefined) {
        await transaction.accountingAccount.updateMany({
          where: { churchId: church.id, id: { in: ids } },
          data: { givingFundId: data.givingFundId },
        });
      }
      if (input.givingEnabled === false) {
        await transaction.accountingAccount.updateMany({
          where: { churchId: church.id, id: { in: ids } },
          data: { givingEnabled: false },
        });
      } else if (input.givingEnabled === true) {
        await transaction.accountingAccount.updateMany({
          where: { churchId: church.id, id: { in: ids } },
          data: { givingEnabled: true },
        });
      }
      if (input.onlineGivingEnabled !== undefined) {
        await transaction.accountingAccount.updateMany({
          where: { churchId: church.id, id: { in: ids } },
          data: { onlineGivingEnabled: data.onlineGivingEnabled },
        });
      }
      return transaction.accountingAccount.findUnique({
        where: { id: account.id },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          parentId: true,
          givingEnabled: true,
          onlineGivingEnabled: true,
          givingFundId: true,
        },
      });
    });
    return NextResponse.json({ account: updated });
  } catch {
    return NextResponse.json(
      { error: "Unable to update giving category." },
      { status: 400 },
    );
  }
}
