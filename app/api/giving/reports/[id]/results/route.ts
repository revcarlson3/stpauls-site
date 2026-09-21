import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSiteIdentity } from "@/lib/site-identity";
import { authorizeReportExecution, authorizeReportModule } from "@/lib/reporting";

function dateFilter(criteria: Record<string, unknown>) {
  const batchDate: { gte?: Date; lte?: Date } = {};
  if (typeof criteria.dateFrom === "string" && criteria.dateFrom) batchDate.gte = new Date(`${criteria.dateFrom}T00:00:00`);
  if (typeof criteria.dateTo === "string" && criteria.dateTo) batchDate.lte = new Date(`${criteria.dateTo}T23:59:59.999`);
  return Object.keys(batchDate).length ? { batchDate } : {};
}

function matchesFilters(
  contribution: {
    amount: unknown;
    member: { firstName: string; lastName: string | null; envelopeNumber: string | null; family: { lastName: string | null } } | null;
    category: { code: string; name: string };
    paymentType: string;
    memo: string | null;
    pledgeCampaign: { name: string } | null;
  },
  criteria: Record<string, unknown>,
) {
  const conditions = Array.isArray(criteria.conditions)
    ? criteria.conditions.filter(
        (condition): condition is { field: string; operator: string; value: string } =>
          Boolean(condition) &&
          typeof condition === "object" &&
          typeof condition.field === "string" &&
          typeof condition.operator === "string" &&
          typeof condition.value === "string",
      )
    : [];
  if (!conditions.length) return true;
  const memberName = contribution.member
    ? `${contribution.member.lastName ?? contribution.member.family.lastName}, ${contribution.member.firstName}`
    : "";
  const values: Record<string, string> = {
    memberName,
    envelopeNumber: contribution.member?.envelopeNumber ?? "",
    categoryCode: contribution.category.code,
    categoryName: contribution.category.name,
    pledgeCampaign: contribution.pledgeCampaign?.name ?? "",
    paymentType: contribution.paymentType,
    amount: String(Number(contribution.amount)),
    memo: contribution.memo ?? "",
  };
  const matches = conditions.map((condition) => {
    const actual = values[condition.field] ?? "";
    const expected = condition.value.trim();
    if (condition.field === "amount") {
      const actualNumber = Number(actual);
      const expectedNumber = Number(expected);
      if (!Number.isFinite(expectedNumber)) return false;
      if (condition.operator === "greaterOrEqual") return actualNumber >= expectedNumber;
      if (condition.operator === "lessOrEqual") return actualNumber <= expectedNumber;
    }

    if (condition.operator === "equals") return actual.toLowerCase() === expected.toLowerCase();
    if (condition.operator === "notEquals") return actual.toLowerCase() !== expected.toLowerCase();
    return actual.toLowerCase().includes(expected.toLowerCase());
  });
  return criteria.match === "any" ? matches.some(Boolean) : matches.every(Boolean);
}

function getGroupingCounts(rows: Array<Record<string, unknown>>, grouping: unknown) {
  const key = grouping && typeof grouping === "object" && typeof (grouping as { key?: unknown }).key === "string" ? (grouping as { key: string }).key : "";
  if (!key) return [];
  const direction = grouping && typeof grouping === "object" && (grouping as { direction?: unknown }).direction === "desc" ? "desc" : "asc";
  const aggregation = grouping && typeof grouping === "object" ? (grouping as { aggregation?: unknown }).aggregation : "count";
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[key] ?? "—");
    counts.set(label, (counts.get(label) ?? 0) + (aggregation === "sumAmount" ? Number(row.amount ?? 0) : 1));
  }

  return Array.from(counts, ([label, count]) => ({ label, count }))
    .sort((left, right) => left.label.localeCompare(right.label) * (direction === "desc" ? -1 : 1));
}

function aggregateRows(rows: Array<Record<string, unknown>>, grouping: unknown) {
  if (!grouping || typeof grouping !== "object" || (grouping as { aggregation?: unknown }).aggregation !== "sumAmount") return rows;
  const key = typeof (grouping as { key?: unknown }).key === "string" ? (grouping as { key: string }).key : "";
  if (!key) return rows;
  const grouped = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const label = String(row[key] ?? "—");
    const existing = grouped.get(label);
    if (existing) {
      existing.amount = Number(existing.amount ?? 0) + Number(row.amount ?? 0);
    } else {
      grouped.set(label, { ...row, id: `group-${label}`, amount: Number(row.amount ?? 0) });
    }
  }
  const direction = (grouping as { direction?: unknown }).direction === "desc" ? "desc" : "asc";
  return Array.from(grouped.values()).sort((left, right) =>
    String(left[key] ?? "").localeCompare(String(right[key] ?? "")) * (direction === "desc" ? -1 : 1),
  );
}

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const url = new URL(_request.url);
    const requestedChurchId = url.searchParams.get("churchId") || undefined;
    const preliminaryScope = await authorizeReportModule({ module: "giving", churchId: requestedChurchId });
    const church = { id: preliminaryScope.churchId };
    let report = await db.givingReport.findFirst({ where: { id: context.params.id, churchId: church.id } });
    if (context.params.id === "preview") {
      const definition = new URL(_request.url).searchParams.get("definition");
      if (!definition) return NextResponse.json({ error: "Report definition is required." }, { status: 400 });
      try {
        const preview = JSON.parse(definition) as Record<string, unknown>;
        report = { ...preview, id: "preview", name: typeof preview.name === "string" && preview.name ? preview.name : "One-time report", criteria: preview.criteria ?? {}, columns: preview.columns ?? [], layout: preview.layout ?? {} } as typeof report;
      } catch {
        return NextResponse.json({ error: "Invalid report definition." }, { status: 400 });
      }
    }
    if (!report) return NextResponse.json({ error: "Giving report not found." }, { status: 404 });
    await authorizeReportExecution({ module: "giving", reportType: report.reportType, churchId: requestedChurchId });
    const criteria = (report.criteria ?? {}) as Record<string, unknown>;
    if (report.reportType === "pledge-statements") {
      return NextResponse.json({ report, rows: [], summary: null, unavailable: true });
    }
    if (report.reportType === "categories") {
      const categories = await db.accountingAccount.findMany({
        where: {
          churchId: church.id,
          isActive: true,
          givingEnabled: true,
          parentId: { not: null },
          children: { none: {} },
        },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, parent: { select: { code: true } } },
      });
      const rows = categories.map((category) => ({ id: category.id, code: category.code, name: category.name, parentCode: category.parent?.code ?? "—" }));
      return NextResponse.json({ report, rows, summary: { total: rows.length, amount: 0 } });
    }
    const allContributions = await db.givingContribution.findMany({
      where: {
        batch: { churchId: church.id, isPosted: true, ...dateFilter(criteria) },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        amount: true,
        member: { select: { firstName: true, lastName: true, envelopeNumber: true, family: { select: { lastName: true } } } },
        category: { select: { code: true, name: true, parent: { select: { name: true } } } },
        batch: { select: { batchDate: true } },
        paymentType: true,
        memo: true,
        deductible: true,
        pledgeCampaign: { select: { name: true } },
      },
    });
    const contributions = allContributions.filter((contribution) =>
      matchesFilters(contribution, criteria),
    );
    if (report.reportType === "contribution-statements") {
      const site = await getSiteIdentity();
      const memberIds = Array.from(new Set(contributions.map((contribution) => contribution.member?.envelopeNumber).filter(Boolean)));
      const statementMembers = memberIds.length
        ? await db.membershipIndividual.findMany({
            where: { envelopeNumber: { in: memberIds as string[] } },
            select: {
              id: true, firstName: true, lastName: true, envelopeNumber: true,
              family: {
                select: {
                  lastName: true, addressStreet: true, addressCity: true, addressState: true, addressZip: true,
                  phone: true, email: true,
                  individuals: { select: { firstName: true, lastName: true, envelopeNumber: true }, orderBy: { envelopeNumber: "asc" } },
                },
              },
            },
          })
        : [];
      const membersByEnvelope = new Map(statementMembers.map((member) => [member.envelopeNumber, member]));
      const statements = Array.from(new Set(contributions.map((contribution) => contribution.member?.envelopeNumber).filter((value): value is string => Boolean(value)))).map((envelopeNumber) => {
        const member = membersByEnvelope.get(envelopeNumber);
        const memberContributions = contributions.filter((contribution) => contribution.member?.envelopeNumber === envelopeNumber);
        const head = member?.family.individuals.find((individual) => individual.envelopeNumber) ?? member;
        const deductible = memberContributions.filter((contribution) => contribution.deductible);
        const nondeductible = memberContributions.filter((contribution) => !contribution.deductible);
        return {
          id: envelopeNumber,
          church: {
            name: site.name, addressStreet: site.addressStreet, addressCity: site.addressCity, addressState: site.addressState,
            addressZip: site.addressZip, phone: site.phone, email: site.email, taxId: site.taxId,
          },
          household: {
            name: head ? `${head.firstName} ${head.lastName ?? member?.family.lastName ?? ""}`.trim() : "Household",
            addressStreet: member?.family.addressStreet ?? "", addressCity: member?.family.addressCity ?? "",
            addressState: member?.family.addressState ?? "", addressZip: member?.family.addressZip ?? "",
          },
          envelopeNumber,
          rows: memberContributions.map((contribution) => ({
            id: contribution.id,
            date: contribution.batch.batchDate.toISOString().slice(0, 10),
            category: contribution.category.name,
            amount: Number(contribution.amount),
            deductible: contribution.deductible,
          })),
          totals: {
            deductible: deductible.reduce((sum, contribution) => sum + Number(contribution.amount), 0),
            nondeductible: nondeductible.reduce((sum, contribution) => sum + Number(contribution.amount), 0),
            total: memberContributions.reduce((sum, contribution) => sum + Number(contribution.amount), 0),
          },
        };
      });
      return NextResponse.json({ report, statements, rows: [], summary: { total: contributions.length, amount: contributions.reduce((sum, item) => sum + Number(item.amount), 0) } });
    }
    if (report.reportType === "giving-report") {
      const byCategory = new Map<string, { id: string; categoryCode: string; categoryName: string; parentName: string; section: "general" | "nonBudget"; amount: number }>();
      for (const contribution of contributions) {
        const key = contribution.category.code;
        const accountCode = Number.parseInt(contribution.category.code, 10);
        const current = byCategory.get(key) ?? {
          id: key,
          categoryCode: key,
          categoryName: contribution.category.name,
          parentName: contribution.category.parent?.name ?? "",
          section: accountCode >= 40000 && accountCode < 60000 ? "general" : "nonBudget",
          amount: 0,
        };
        current.amount += Number(contribution.amount);
        byCategory.set(key, current);
      }
      const rows = Array.from(byCategory.values()).sort((left, right) => left.categoryCode.localeCompare(right.categoryCode));
      return NextResponse.json({ report, rows, groupingCounts: getGroupingCounts(rows, report.grouping), summary: { total: contributions.length, amount: contributions.reduce((sum, item) => sum + Number(item.amount), 0) } });
    }
    const rows = contributions.map((contribution) => ({
      id: contribution.id,
      batchDate: contribution.batch.batchDate.toISOString().slice(0, 10),
      envelopeNumber: contribution.member?.envelopeNumber ?? "—",
      memberName: contribution.member ? `${contribution.member.lastName ?? contribution.member.family.lastName}, ${contribution.member.firstName}` : "—",
      amount: Number(contribution.amount),
      categoryCode: contribution.category.code,
      categoryName: contribution.category.name,
      paymentType: contribution.paymentType,
      pledgeCampaign: contribution.pledgeCampaign?.name ?? "—",
      memo: contribution.memo ?? "—",
    }));
    const resultRows = aggregateRows(rows, report.grouping) as typeof rows;
    return NextResponse.json({ report, rows: resultRows, groupingCounts: getGroupingCounts(rows, report.grouping), summary: { total: rows.length, amount: rows.reduce((sum, item) => sum + item.amount, 0) } });
  } catch {
    return NextResponse.json({ error: "Unable to run giving report." }, { status: 403 });
  }
}
