import { db } from "@/lib/db";
import { parentCodeForAccount } from "@/lib/accounting";

const PAYMENT_METHODS = [
  "CHECK",
  "CASH",
  "DEBIT_CARD",
  "ACH",
  "BILL_PAY",
  "PAYROLL",
  "DEP",
  "TRANSFER",
] as const;
const TRANSACTION_TYPES = ["DEBIT", "CREDIT"] as const;
const ENTRY_TYPES = [
  "STANDARD",
  "BANK_TRANSFER",
  "FUND_TRANSFER",
  "ACCOUNT_TRANSFER",
] as const;

function signedAmount(value: unknown, transactionType: string) {
  const raw =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  const numeric = Number(raw);
  if (!raw || !Number.isFinite(numeric) || numeric === 0) return null;
  return raw.startsWith("-")
    ? -Math.abs(numeric)
    : raw.startsWith("+")
      ? Math.abs(numeric)
      : transactionType === "DEBIT"
        ? -Math.abs(numeric)
        : Math.abs(numeric);
}

export async function buildEntry(
  input: Record<string, unknown>,
  churchId: string,
  options: { allowedParentAccountIds?: Set<string> } = {},
) {
  const entryType =
    typeof input.entryType === "string"
      ? input.entryType.trim().toUpperCase()
      : "STANDARD";
  const bankAccountId =
    typeof input.bankAccountId === "string" ? input.bankAccountId : "";
  const destinationBankAccountId =
    typeof input.destinationBankAccountId === "string"
      ? input.destinationBankAccountId
      : "";
  const accountId = typeof input.accountId === "string" ? input.accountId : "";
  const destinationAccountId =
    typeof input.destinationAccountId === "string"
      ? input.destinationAccountId
      : "";
  const fundId =
    typeof input.fundId === "string" && input.fundId ? input.fundId : null;
  const destinationFundId =
    typeof input.destinationFundId === "string" && input.destinationFundId
      ? input.destinationFundId
      : null;
  const description =
    typeof input.description === "string"
      ? input.description.trim().slice(0, 200)
      : "";
  const reference =
    typeof input.reference === "string"
      ? input.reference.trim().slice(0, 80)
      : null;
  const paymentMethod =
    typeof input.paymentMethod === "string"
      ? input.paymentMethod.trim().toUpperCase()
      : "";
  const transactionType =
    typeof input.transactionType === "string"
      ? input.transactionType.trim().toUpperCase()
      : "";
  const amount = signedAmount(input.amount, transactionType);
  const transactionDate = new Date(
    typeof input.date === "string" ? input.date : "",
  );
  if (
    !ENTRY_TYPES.includes(entryType as (typeof ENTRY_TYPES)[number]) ||
    !description ||
    !PAYMENT_METHODS.includes(
      paymentMethod as (typeof PAYMENT_METHODS)[number],
    ) ||
    Number.isNaN(transactionDate.getTime()) ||
    amount === null ||
    Math.abs(amount) > 1000000000
  )
    return null;
  if (
    entryType === "STANDARD" &&
    (!bankAccountId ||
      !TRANSACTION_TYPES.includes(
        transactionType as (typeof TRANSACTION_TYPES)[number],
      ))
  )
    return null;
  if (
    entryType === "BANK_TRANSFER" &&
    (!bankAccountId ||
      !destinationBankAccountId ||
      bankAccountId === destinationBankAccountId)
  )
    return null;
  if (
    entryType === "FUND_TRANSFER" &&
    (!bankAccountId ||
      !fundId ||
      !destinationFundId ||
      fundId === destinationFundId)
  )
    return null;
  if (
    entryType === "ACCOUNT_TRANSFER" &&
    (!bankAccountId ||
      !accountId ||
      !destinationAccountId ||
      accountId === destinationAccountId)
  )
    return null;
  const transferAmount = Math.abs(amount);
  if (
    entryType !== "STANDARD" &&
    (!transferAmount || paymentMethod !== "TRANSFER")
  )
    return null;
  const allocations = Array.isArray(input.allocations)
    ? input.allocations.map((value) => {
        const allocation =
          value && typeof value === "object"
            ? (value as Record<string, unknown>)
            : {};
        return {
          accountId:
            typeof allocation.accountId === "string"
              ? allocation.accountId
              : "",
          fundId:
            typeof allocation.fundId === "string" && allocation.fundId
              ? allocation.fundId
              : null,
          amount: Math.abs(Number(allocation.amount)),
        };
      })
    : [{ accountId, fundId, amount: transferAmount }];
  if (
    entryType === "STANDARD" &&
    (!allocations.length ||
      allocations.some(
        (allocation) =>
          !allocation.accountId ||
          !Number.isFinite(allocation.amount) ||
          allocation.amount <= 0,
      ) ||
      Math.round(
        allocations.reduce((sum, allocation) => sum + allocation.amount, 0) *
          100,
      ) !== Math.round(transferAmount * 100))
  )
    return null;
  const allocationAccountIds = Array.from(
    new Set(allocations.map((allocation) => allocation.accountId)),
  );
  const allocationFundIds = Array.from(
    new Set(
      allocations
        .map((allocation) => allocation.fundId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const [
    bankAccount,
    destinationBankAccount,
    account,
    destinationAccount,
    fund,
    destinationFund,
    bankAssetAccount,
  ] = await Promise.all([
    bankAccountId
      ? db.accountingBankAccount.findFirst({
          where: { id: bankAccountId, churchId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    destinationBankAccountId
      ? db.accountingBankAccount.findFirst({
          where: { id: destinationBankAccountId, churchId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    accountId
      ? db.accountingAccount.findFirst({
          where: { id: accountId, churchId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    destinationAccountId
      ? db.accountingAccount.findFirst({
          where: { id: destinationAccountId, churchId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    fundId
      ? db.accountingFund.findFirst({
          where: { id: fundId, churchId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    destinationFundId
      ? db.accountingFund.findFirst({
          where: { id: destinationFundId, churchId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    db.accountingAccount.findFirst({
      where: { churchId, code: "11000", isActive: true },
      select: { id: true },
    }),
  ]);
  const [allocationAccounts, allocationFunds, chartAccounts] =
    entryType === "STANDARD"
      ? await Promise.all([
          db.accountingAccount.findMany({
            where: {
              churchId,
              id: { in: allocationAccountIds },
              isActive: true,
            },
            select: { id: true },
          }),
          db.accountingFund.findMany({
            where: { churchId, id: { in: allocationFundIds }, isActive: true },
            select: { id: true },
          }),
          db.accountingAccount.findMany({
            where: { churchId },
            select: { id: true, code: true, parentId: true },
          }),
        ])
      : [[], [], []];
  const parentAccountIds = new Set(
    chartAccounts
      .filter(
        (candidate) =>
          candidate.parentId ||
          chartAccounts.some(
            (child) =>
              child.parentId === candidate.id ||
              parentCodeForAccount(child.code) === candidate.code,
          ),
      )
      .map((candidate) => candidate.id),
  );
  const selectedChartAccountIds = [
    accountId,
    destinationAccountId,
    ...allocationAccountIds,
  ].filter(Boolean);
  const allowedParentAccountIds =
    options.allowedParentAccountIds ?? new Set<string>();
  if (
    (bankAccountId && !bankAccount) ||
    (destinationBankAccountId && !destinationBankAccount) ||
    (accountId && !account) ||
    (destinationAccountId && !destinationAccount) ||
    (fundId && !fund) ||
    (destinationFundId && !destinationFund) ||
    !bankAssetAccount ||
    selectedChartAccountIds.some(
      (id) => parentAccountIds.has(id) && !allowedParentAccountIds.has(id),
    ) ||
    (entryType === "STANDARD" &&
      (allocationAccounts.length !== allocationAccountIds.length ||
        allocationFunds.length !== allocationFundIds.length))
  )
    return null;
  const allocationLines = allocations.map((allocation) => ({
    accountId: allocation.accountId,
    fundId: allocation.fundId,
    memo: description,
    debit: amount < 0 ? allocation.amount.toFixed(2) : "0.00",
    credit: amount > 0 ? allocation.amount.toFixed(2) : "0.00",
  }));
  const lines =
    entryType === "BANK_TRANSFER"
      ? [
          {
            accountId: bankAssetAccount.id,
            bankAccountId: bankAccount!.id,
            memo: description,
            debit: transferAmount.toFixed(2),
            credit: "0.00",
          },
          {
            accountId: bankAssetAccount.id,
            bankAccountId: destinationBankAccount!.id,
            memo: description,
            debit: "0.00",
            credit: transferAmount.toFixed(2),
          },
        ]
      : entryType === "FUND_TRANSFER"
        ? [
            {
              accountId: bankAssetAccount.id,
              bankAccountId: bankAccount!.id,
              fundId: destinationFund!.id,
              memo: description,
              debit: transferAmount.toFixed(2),
              credit: "0.00",
            },
            {
              accountId: bankAssetAccount.id,
              bankAccountId: bankAccount!.id,
              fundId: fund!.id,
              memo: description,
              debit: "0.00",
              credit: transferAmount.toFixed(2),
            },
          ]
        : entryType === "ACCOUNT_TRANSFER"
          ? [
              {
                accountId: destinationAccount!.id,
                memo: description,
                debit: transferAmount.toFixed(2),
                credit: "0.00",
              },
              {
                accountId: account!.id,
                memo: description,
                debit: "0.00",
                credit: transferAmount.toFixed(2),
              },
            ]
          : [
              {
                accountId: bankAssetAccount.id,
                bankAccountId: bankAccount!.id,
                fundId,
                memo: description,
                debit: amount > 0 ? amount.toFixed(2) : "0.00",
                credit: amount < 0 ? transferAmount.toFixed(2) : "0.00",
              },
              ...allocationLines,
            ];
  return {
    entryType,
    bankAccountId: bankAccount?.id ?? null,
    transactionDate,
    description,
    reference,
    paymentMethod,
    transactionType,
    amount,
    lines,
  };
}
