import { db } from "@/lib/db";
import { ensureAccountingFoundation } from "@/lib/accounting";

export function fiscalDates(year: number, month: number, day: number) {
  const startsOn = new Date(Date.UTC(year, month - 1, day));
  const endsOn = new Date(Date.UTC(year + 1, month - 1, day - 1));
  return { startsOn, endsOn };
}

export async function ensureStandardBudget(churchId: string, year: number, copyFromFiscalYear?: number) {
  const settings = await ensureAccountingFoundation(churchId);
  const dates = fiscalDates(year, settings.fiscalYearStartMonth, settings.fiscalYearStartDay);
  const existing = await db.accountingBudget.findUnique({
    where: { churchId_name_fiscalYear: { churchId, name: "Standard", fiscalYear: year } },
    include: { items: { include: { account: true }, orderBy: { account: { code: "asc" } } } }
  });
  if (existing) return existing;
  const accounts = await db.accountingAccount.findMany({
    where: { churchId, isActive: true, OR: [{ code: { startsWith: "4" } }, { code: { startsWith: "5" } }] },
    orderBy: { code: "asc" }
  });
  const source = copyFromFiscalYear
    ? await db.accountingBudget.findUnique({
        where: { churchId_name_fiscalYear: { churchId, name: "Standard", fiscalYear: copyFromFiscalYear } },
        include: { items: { include: { account: { select: { code: true } } } } }
      })
    : null;
  const sourceByCode = new Map(source?.items.map((item) => [item.account.code, item]) ?? []);
  return db.accountingBudget.create({
    data: {
      churchId, name: "Standard", fiscalYear: year, startDate: dates.startsOn, endDate: dates.endsOn,
      entryMode: source?.entryMode ?? "MONTHLY",
      items: {
        create: accounts.map((account) => {
          const previous = sourceByCode.get(account.code);
          return {
            accountId: account.id,
            isEnabled: previous?.isEnabled ?? true,
            annualAmount: previous?.annualAmount ?? 0,
            month01: previous?.month01 ?? 0,
            month02: previous?.month02 ?? 0,
            month03: previous?.month03 ?? 0,
            month04: previous?.month04 ?? 0,
            month05: previous?.month05 ?? 0,
            month06: previous?.month06 ?? 0,
            month07: previous?.month07 ?? 0,
            month08: previous?.month08 ?? 0,
            month09: previous?.month09 ?? 0,
            month10: previous?.month10 ?? 0,
            month11: previous?.month11 ?? 0,
            month12: previous?.month12 ?? 0
          };
        })
      }
    },
    include: { items: { include: { account: true }, orderBy: { account: { code: "asc" } } } }
  });
}
