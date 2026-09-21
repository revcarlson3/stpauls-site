import { db } from "@/lib/db";

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
export type AccountingAccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_FUNCTIONS = [
  "Outreach", "Pastoral support", "Christian worship", "Christian witness",
  "Christian Stewardship", "Christian growth", "Christian youth", "Christian welfare",
  "Christian School", "Administration", "Church properties"
] as const;

const account = (code: string, name: string, type: AccountingAccountType, description?: string) => ({ code, name, type, description });
/** The LCMS Congregational Treasurers Manual account hierarchy. */
export const defaultAccounts = [
  account("10000", "Assets", "ASSET"),
  account("11000", "Cash and cash equivalents", "ASSET"),
  account("11011", "First National Bank", "ASSET"),
  account("11012", "Second National Bank", "ASSET"),
  account("11015", "Petty cash", "ASSET"),
  account("12000", "Investments", "ASSET"),
  account("12010", "First National Bank", "ASSET"),
  account("12020", "Church Extension Fund", "ASSET"),
  account("12030", "Term note", "ASSET"),
  account("12040", "Stocks", "ASSET"),
  account("13000", "Receivables", "ASSET"),
  account("13010", "Accounts receivable", "ASSET"),
  account("13020", "Promises to give receivable", "ASSET"),
  account("13030", "Accrued interest receivable", "ASSET"),
  account("13040", "Notes and contracts receivable", "ASSET"),
  account("13200", "Inventories", "ASSET"),
  account("14000", "Prepaid expenses", "ASSET"),
  account("14010", "Insurance", "ASSET"),
  account("15000", "Land and buildings", "ASSET"),
  account("15010", "Land", "ASSET"),
  account("15020", "Church building", "ASSET"),
  account("15030", "Fellowship hall", "ASSET"),
  account("15040", "School building", "ASSET"),
  account("15050", "Gymnasium", "ASSET"),
  account("15060", "Parsonage", "ASSET"),
  account("15070", "Accumulated depreciation", "ASSET"),
  account("16000", "Furniture and equipment", "ASSET"),
  account("16010", "Office equipment", "ASSET"),
  account("16020", "School equipment", "ASSET"),
  account("16030", "Playground equipment", "ASSET"),
  account("16040", "Audiovisual equipment", "ASSET"),
  account("16070", "Accumulated depreciation", "ASSET"),
  account("20000", "Liabilities", "LIABILITY"),
  account("21000", "Accounts payable", "LIABILITY"),
  account("21011", "Trades payable", "LIABILITY"),
  account("22000", "Accrued payroll", "LIABILITY"),
  account("22011", "Accrued vacation pay", "LIABILITY"),
  account("23000", "Payroll taxes withheld", "LIABILITY"),
  account("23021", "Federal income tax", "LIABILITY"),
  account("23022", "Social Security taxes", "LIABILITY"),
  account("23023", "Medicare taxes", "LIABILITY"),
  account("23024", "State income taxes", "LIABILITY"),
  account("23025", "County income taxes", "LIABILITY"),
  account("23026", "Other tax", "LIABILITY"),
  account("24000", "Promises to give payable", "LIABILITY"),
  account("25000", "Agency funds payable", "LIABILITY"),
  account("25001", "American Bible Society", "LIABILITY"),
  account("25002", "Armed Forces", "LIABILITY"),
  account("25005", "Bethesda Lutheran Home", "LIABILITY"),
  account("25010", "Concordia Seminary - St. Louis", "LIABILITY"),
  account("25011", "Concordia Seminary - Fort Wayne", "LIABILITY"),
  account("25020", "Lutheran Hour", "LIABILITY"),
  account("25021", "Lutheran TV", "LIABILITY"),
  account("25040", "Wheat Ridge Seals", "LIABILITY"),
  account("25041", "World Hunger", "LIABILITY"),
  account("25042", "World Relief", "LIABILITY"),
  account("25050", "Local ministry program", "LIABILITY"),
  account("26000", "Mortgages and notes payable", "LIABILITY"),
  account("26010", "First National", "LIABILITY"),
  account("26020", "Lutheran Church Extension Fund", "LIABILITY"),
  account("30000", "Net Assets", "EQUITY"),
  account("31000", "General Fund (unrestricted)", "EQUITY"),
  account("32000", "Net Investment in Property and Equipment", "EQUITY"),
  account("33000", "Board Designated Funds", "EQUITY"),
  account("34000", "Temporarily Restricted Funds", "EQUITY"),
  account("35000", "Endowment Funds", "EQUITY"),
  account("40000", "Income - Unrestricted", "INCOME"),
  account("41000", "Worship service offerings", "INCOME"),
  account("41010", "Regular envelopes", "INCOME"),
  account("41020", "Mission offerings", "INCOME"),
  account("41030", "Building fund offerings", "INCOME"),
  account("41040", "Plate offerings", "INCOME"),
  account("41050", "Christmas Day offerings", "INCOME"),
  account("41060", "Christmas Eve offerings", "INCOME"),
  account("41070", "Thanksgiving Day offering", "INCOME"),
  account("41080", "Lent", "INCOME"),
  account("41090", "Advent", "INCOME"),
  account("42000", "Other receipts", "INCOME"),
  account("42010", "Gifts and bequests", "INCOME"),
  account("42020", "Interest income", "INCOME"),
  account("42030", "Investment income", "INCOME"),
  account("43000", "Day school fees", "INCOME"),
  account("43010", "Tuition - members", "INCOME"),
  account("43020", "Tuition - non-members", "INCOME"),
  account("43030", "School registration fees", "INCOME"),
  account("43040", "Book rentals and fees", "INCOME"),
  account("43050", "School lunch program fees", "INCOME"),
  account("50000", "Expenses - Unrestricted", "EXPENSE"),
  account("50100", "Outreach - beyond congregation", "EXPENSE"),
  account("50180", "District - Synod support", "EXPENSE"),
  account("50185", "Convention assessment", "EXPENSE"),
  account("50189", "Local mission support", "EXPENSE"),
  account("50200", "Pastoral support", "EXPENSE"),
  account("50201", "Salaries", "EXPENSE"),
  account("50203", "FICA and Medicare Taxes", "EXPENSE"),
  account("50204", "Employee benefits", "EXPENSE"),
  account("50207", "Housing allowance", "EXPENSE"),
  account("50209", "Automobile expense", "EXPENSE"),
  account("50210", "Continuing education", "EXPENSE"),
  account("50211", "Utilities allowance", "EXPENSE"),
  account("50212", "Conferences and workshops", "EXPENSE"),
  account("50219", "Guest pastors/speakers", "EXPENSE"),
  account("50300", "Christian worship", "EXPENSE"),
  account("50321", "Altar supplies", "EXPENSE"),
  account("50322", "Service bulletins", "EXPENSE"),
  account("50323", "Hymnals", "EXPENSE"),
  account("50324", "Choir music", "EXPENSE"),
  account("50400", "Christian witness", "EXPENSE"),
  account("50425", "Publicity/signs", "EXPENSE"),
  account("50426", "Radio-TV", "EXPENSE"),
  account("50500", "Christian stewardship", "EXPENSE"),
  account("50528", "Offering envelopes", "EXPENSE"),
  account("50600", "Christian growth", "EXPENSE"),
  account("50640", "Sunday school materials", "EXPENSE"),
  account("50641", "Vacation Bible school", "EXPENSE"),
  account("50642", "Adult Bible study materials", "EXPENSE"),
  account("50643", "Church library", "EXPENSE"),
  account("50644", "Lutheran Witness", "EXPENSE"),
  account("50645", "Portals of Prayer", "EXPENSE"),
  account("50647", "Audio visual materials", "EXPENSE"),
  account("50700", "Christian youth", "EXPENSE"),
  account("50712", "Conferences and workshops", "EXPENSE"),
  account("50760", "Leadership training", "EXPENSE"),
  account("50800", "Christian welfare", "EXPENSE"),
  account("50900", "Christian day school", "EXPENSE"),
  account("50901", "Salaries", "EXPENSE"),
  account("50903", "FICA and Medicare taxes", "EXPENSE"),
  account("50904", "Employee benefits", "EXPENSE"),
  account("50907", "Housing allowance", "EXPENSE"),
  account("50909", "Automobile expense", "EXPENSE"),
  account("50910", "Continuing education", "EXPENSE"),
  account("50911", "Utilities allowance", "EXPENSE"),
  account("50912", "Conferences and workshops", "EXPENSE"),
  account("50919", "Substitute teachers", "EXPENSE"),
  account("50920", "Office supplies", "EXPENSE"),
  account("50948", "School curriculum", "EXPENSE"),
  account("50952", "Equipment maintenance", "EXPENSE"),
  account("50953", "Equipment repairs", "EXPENSE"),
  account("50954", "Depreciation - equipment", "EXPENSE"),
  account("50970", "Telephone", "EXPENSE"),
  account("50972", "Utilities", "EXPENSE"),
  account("50973", "Insurance", "EXPENSE"),
  account("50990", "Other expense", "EXPENSE"),
  account("51000", "Administration", "EXPENSE"),
  account("51001", "Salaries", "EXPENSE"),
  account("51003", "FICA and Medicare taxes", "EXPENSE"),
  account("51004", "Employee benefits", "EXPENSE"),
  account("51007", "Housing allowance", "EXPENSE"),
  account("51012", "Conferences and workshops", "EXPENSE"),
  account("51020", "Office supplies", "EXPENSE"),
  account("51052", "Equipment maintenance", "EXPENSE"),
  account("51053", "Equipment repairs", "EXPENSE"),
  account("51054", "Depreciation - equipment", "EXPENSE"),
  account("51070", "Telephone", "EXPENSE"),
  account("51090", "Other expense", "EXPENSE"),
  account("51100", "Church property", "EXPENSE"),
  account("51151", "Rental", "EXPENSE"),
  account("51170", "Telephone", "EXPENSE"),
  account("51172", "Utilities", "EXPENSE"),
  account("51174", "Maintenance and repairs", "EXPENSE"),
  account("51176", "Depreciation - building", "EXPENSE"),
  account("51177", "Interest expense", "EXPENSE"),
  account("51178", "Utilities - parsonage", "EXPENSE"),
  account("51179", "Repairs - parsonage", "EXPENSE"),
  account("51190", "Other expense", "EXPENSE"),
  account("60000", "Income - Restricted", "INCOME"),
  account("60010", "Building Fund", "INCOME"),
  account("60020", "Organ Fund", "INCOME"),
  account("60030", "World Mission Project", "INCOME"),
  account("70000", "Expenses - Restricted", "EXPENSE"),
  account("70010", "Building Program", "EXPENSE"),
  account("70020", "Organ Fund", "EXPENSE"),
  account("70030", "World Mission Project", "EXPENSE")
] as const;

/** The code immediately above an account in the standard five-digit hierarchy. */
export function parentCodeForAccount(code: string) {
  if (!validateAccountCode(code)) return null;
  if (code.slice(3) !== "00") return `${code.slice(0, 3)}00`;
  if (code.slice(2) !== "000") return `${code.slice(0, 2)}000`;
  if (code.slice(1) !== "0000") return `${code[0]}0000`;
  return null;
}

export const defaultFunds = [{ code: "GENERAL", name: "General fund" }] as const;

export function validateAccountCode(code: string) {
  return /^\d{5}$/.test(code);
}

export function accountTypeForCode(code: string): AccountingAccountType | null {
  if (!validateAccountCode(code)) return null;
  const types: Record<string, AccountingAccountType> = { "1": "ASSET", "2": "LIABILITY", "3": "EQUITY", "4": "INCOME", "5": "EXPENSE", "6": "INCOME", "7": "EXPENSE" };
  return types[code[0]] ?? null;
}

/** Creates only missing foundation records for a church; existing accounting data is never changed. */
export async function ensureAccountingFoundation(churchId: string) {
  const settings = await db.accountingSettings.upsert({ where: { churchId }, update: {}, create: { churchId } });
  const year = new Date().getUTCFullYear();
  const startsOn = new Date(Date.UTC(year, settings.fiscalYearStartMonth - 1, settings.fiscalYearStartDay));
  const endsOn = new Date(Date.UTC(year + 1, settings.fiscalYearStartMonth - 1, settings.fiscalYearStartDay - 1));
  await db.accountingFiscalYear.upsert({ where: { churchId_year: { churchId, year } }, update: {}, create: { churchId, year, startsOn, endsOn } });

  // Replace the earlier generated chart and its journal history once, when the
  // LCMS root account has not yet been installed for this church.
  const lcmsMarker = await db.accountingAccount.findFirst({ where: { churchId, code: "11011" }, select: { id: true } });
  if (!lcmsMarker) {
    await db.accountingJournalEntry.deleteMany({ where: { churchId } });
    await db.accountingAccount.deleteMany({ where: { churchId } });
  }
  const accountCount = await db.accountingAccount.count({ where: { churchId } });
  if (accountCount === 0) {
    await db.accountingAccount.createMany({ data: defaultAccounts.map(({ description, ...item }) => ({ ...item, description: description ?? null, churchId })), skipDuplicates: true });
  }
  // Link standard records after creation so this also repairs foundations created
  // by an older version without changing their IDs or journal lines.
  const standard = await db.accountingAccount.findMany({ where: { churchId, code: { in: defaultAccounts.map(({ code }) => code) } }, select: { id: true, code: true } });
  const byCode = new Map(standard.map((item) => [item.code, item.id]));
  for (const item of standard) {
    const parentCode = parentCodeForAccount(item.code);
    const parentId = parentCode ? byCode.get(parentCode) ?? null : null;
    await db.accountingAccount.update({ where: { id: item.id }, data: { parentId } });
  }
  await db.accountingFund.createMany({ data: defaultFunds.map((fund) => ({ ...fund, churchId })), skipDuplicates: true });
  return settings;
}

export { defaultAccounts as standardAccounts };
