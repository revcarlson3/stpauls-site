import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { requireCurrentChurch } from "@/lib/tenant";

async function authorize() {
  const user = await requirePermission("MANAGE_GIVING");
  await requireEnabledModule("giving", user.id, "MANAGE_GIVING");
  return (await requireCurrentChurch()).church;
}

export async function GET(request: Request) {
  try {
    const church = await authorize();
    const params = new URL(request.url).searchParams;
    const campaignId = params.get("campaignId")?.trim() ?? "";
    const campaigns = await db.pledgeCampaign.findMany({
      where: { churchId: church.id },
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        categoryId: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
    });
    const categories = await db.accountingAccount.findMany({
      where: {
        churchId: church.id,
        isActive: true,
        givingEnabled: true,
        parentId: { not: null },
        children: { none: {} },
        OR: [
          { code: { startsWith: "4", not: "40000" } },
          { code: { startsWith: "6", not: "60000" } },
        ],
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    });
    const campaign = campaignId
      ? await db.pledgeCampaign.findFirst({
          where: { id: campaignId, churchId: church.id },
          select: {
            id: true,
            name: true,
            categoryId: true,
            startDate: true,
            endDate: true,
            assignments: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                memberId: true,
                amount: true,
                member: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    envelopeNumber: true,
                  },
                },
              },
            },
          },
        })
      : null;
    let pledgeSummary: Array<{
      memberId: string;
      envelopeNumber: string | null;
      memberName: string;
      pledged: string;
      given: string;
    }> = [];
    if (campaign) {
      const contributionWhere = campaign.categoryId
        ? {
            memberId: { in: campaign.assignments.map((assignment) => assignment.memberId) },
            categoryId: campaign.categoryId,
          pledgeCampaignId: campaign.id,
          batch: {
              churchId: church.id,
              ...(campaign.startDate || campaign.endDate
                ? {
                    batchDate: {
                      ...(campaign.startDate ? { gte: campaign.startDate } : {}),
                      ...(campaign.endDate
                        ? {
                            lt: new Date(
                              campaign.endDate.getTime() + 24 * 60 * 60 * 1000,
                            ),
                          }
                        : {}),
                    },
                  }
                : {}),
            },
          }
        : null;
      const givenByMember = contributionWhere
        ? await db.givingContribution.groupBy({
            by: ["memberId"],
            where: contributionWhere,
            _sum: { amount: true },
          })
        : [];
      const givenMap = new Map(
        givenByMember.map((entry) => [entry.memberId, entry._sum.amount?.toString() ?? "0"]),
      );
      pledgeSummary = campaign.assignments
        .map((assignment) => ({
          memberId: assignment.memberId,
          envelopeNumber: assignment.member.envelopeNumber,
          memberName: [assignment.member.firstName, assignment.member.lastName]
            .filter(Boolean)
            .join(" "),
          pledged: assignment.amount.toString(),
          given: givenMap.get(assignment.memberId) ?? "0",
        }))
        .sort((left, right) => {
          const leftEnvelope = Number(left.envelopeNumber);
          const rightEnvelope = Number(right.envelopeNumber);
          if (Number.isFinite(leftEnvelope) && Number.isFinite(rightEnvelope)) {
            return leftEnvelope - rightEnvelope;
          }
          if (Number.isFinite(leftEnvelope)) return -1;
          if (Number.isFinite(rightEnvelope)) return 1;
          return left.memberName.localeCompare(right.memberName);
        });
    }
    return NextResponse.json({ campaigns, campaign, categories, pledgeSummary });
  } catch {
    return NextResponse.json(
      { error: "Unable to load pledge campaigns." },
      { status: 403 },
    );
  }
}

export async function PATCH(request: Request) {
    try {
      const church = await authorize();
      const input = await request.json();
      const campaignId =
        typeof input?.campaignId === "string" ? input.campaignId.trim() : "";
      if (!campaignId) {
        return NextResponse.json(
          { error: "A pledge campaign is required." },
          { status: 400 },
        );
      }
      const campaign = await db.pledgeCampaign.findFirst({
        where: { id: campaignId, churchId: church.id },
        select: { id: true },
      });
      if (!campaign) {
        return NextResponse.json(
          { error: "Pledge campaign not found." },
          { status: 404 },
        );
      }

      const data: {
        name?: string;
        categoryId?: string | null;
        startDate?: Date | null;
        endDate?: Date | null;
      } = {};
      if (input.name !== undefined) {
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name || name.length > 200) {
          return NextResponse.json(
            { error: "Enter a pledge campaign name no longer than 200 characters." },
            { status: 400 },
          );
        }
        const duplicate = await db.pledgeCampaign.findFirst({
          where: {
            churchId: church.id,
            id: { not: campaignId },
            name: { equals: name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (duplicate) {
          return NextResponse.json(
            { error: "A pledge campaign with that name already exists." },
            { status: 409 },
          );
        }
        data.name = name;
      }
      if (input.categoryId !== undefined) {
        if (input.categoryId !== null && typeof input.categoryId !== "string") {
          return NextResponse.json(
            { error: "The selected pledge category is invalid." },
            { status: 400 },
          );
        }
        if (input.categoryId) {
          const category = await db.accountingAccount.findFirst({
            where: {
              id: input.categoryId,
              churchId: church.id,
              isActive: true,
              givingEnabled: true,
              parentId: { not: null },
              children: { none: {} },
            },
            select: { id: true },
          });
          if (!category) {
            return NextResponse.json(
              { error: "The selected pledge category was not found." },
              { status: 400 },
            );
          }
        }
        data.categoryId = input.categoryId || null;
      }
      for (const field of ["startDate", "endDate"] as const) {
        if (input[field] !== undefined) {
          if (input[field] !== null && typeof input[field] !== "string") {
            return NextResponse.json(
              { error: "The pledge campaign dates are invalid." },
              { status: 400 },
            );
          }
          const value = input[field] ? new Date(input[field]) : null;
          if (value && Number.isNaN(value.getTime())) {
            return NextResponse.json(
              { error: "The pledge campaign dates are invalid." },
              { status: 400 },
            );
          }
          data[field] = value;
        }
      }
      if (data.startDate && data.endDate && data.startDate > data.endDate) {
        return NextResponse.json(
          { error: "The pledge campaign end date must be on or after its start date." },
          { status: 400 },
        );
      }

      const rawAssignments = input.assignments;
      if (rawAssignments !== undefined) {
        if (!Array.isArray(rawAssignments)) {
          return NextResponse.json(
            { error: "Pledge assignments are invalid." },
            { status: 400 },
          );
        }
        const assignments = rawAssignments
          .filter((assignment) => assignment?.memberId || assignment?.amount)
          .map((assignment) => ({
            memberId:
              typeof assignment.memberId === "string"
                ? assignment.memberId.trim()
                : "",
            amount: Number(assignment.amount),
          }));
        if (
          assignments.some(
            (assignment) =>
              !assignment.memberId ||
              !Number.isFinite(assignment.amount) ||
              assignment.amount <= 0,
          )
        ) {
          return NextResponse.json(
            { error: "Enter a member and positive pledge amount for each row used." },
            { status: 400 },
          );
        }
        if (new Set(assignments.map((assignment) => assignment.memberId)).size !== assignments.length) {
          return NextResponse.json(
            { error: "A member can appear only once in a pledge campaign." },
            { status: 400 },
          );
        }
        const members = await db.membershipIndividual.findMany({
          where: {
            id: { in: assignments.map((assignment) => assignment.memberId) },
            status: { not: "REMOVED" },
          },
          select: { id: true },
        });
        if (members.length !== assignments.length) {
          return NextResponse.json(
            { error: "One or more selected members were not found." },
            { status: 400 },
          );
        }
        await db.$transaction(async (transaction) => {
          await transaction.pledgeCampaign.update({
            where: { id: campaignId },
            data,
          });
          await transaction.pledgeAssignment.deleteMany({ where: { campaignId } });
          await transaction.pledgeAssignment.createMany({
            data: assignments.map((assignment) => ({
              campaignId,
              memberId: assignment.memberId,
              amount: assignment.amount,
            })),
          });
        });
      } else if (Object.keys(data).length) {
        await db.pledgeCampaign.update({ where: { id: campaignId }, data });
      }
      return NextResponse.json({ saved: true });
    } catch {
      return NextResponse.json(
        { error: "Unable to save pledge campaign." },
        { status: 400 },
      );
    }
  }

export async function POST(request: Request) {
  try {
    const church = await authorize();
    const input = await request.json();
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 200) {
      return NextResponse.json(
        { error: "Enter a pledge campaign name no longer than 200 characters." },
        { status: 400 },
      );
    }
    const existing = await db.pledgeCampaign.findFirst({
      where: {
        churchId: church.id,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A pledge campaign with that name already exists." },
        { status: 409 },
      );
    }
    const campaign = await db.pledgeCampaign.create({
      data: { churchId: church.id, name },
      select: { id: true, name: true, createdAt: true },
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Unable to create pledge campaign." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const church = await authorize();
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json(
        { error: "A pledge campaign is required." },
        { status: 400 },
      );
    }
    const result = await db.pledgeCampaign.deleteMany({
      where: { id, churchId: church.id },
    });
    if (!result.count) {
      return NextResponse.json(
        { error: "Pledge campaign not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to delete pledge campaign." },
      { status: 400 },
    );
  }
}
