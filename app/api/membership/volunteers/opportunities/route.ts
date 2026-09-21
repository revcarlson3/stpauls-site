import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeVolunteerScheduling } from "@/lib/volunteer-scheduling-auth";
import { logAudit } from "@/lib/audit";
import { MembershipVolunteerInputError, normalizeServiceOpportunityInput } from "@/lib/membership-volunteers";

async function authorize() {
  return authorizeVolunteerScheduling();
}

const select = {
  id: true,
  title: true,
  description: true,
  location: true,
  defaultRole: true,
  isActive: true,
  group: { select: { id: true, name: true } },
  eventTeams: { select: { groupId: true, volunteersNeeded: true, group: { select: { id: true, name: true } } } },
  _count: { select: { shifts: true } }
} as const;

export async function GET() {
  try {
    await authorize();
    const opportunities = await db.membershipServiceOpportunity.findMany({
      orderBy: [{ isActive: "desc" }, { title: "asc" }],
      select
    });
    return NextResponse.json({ opportunities });
  } catch {
    return NextResponse.json({ error: "Unable to load service opportunities." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const input = await request.json();
    const data = normalizeServiceOpportunityInput(input);
    const requirements = Array.isArray(input?.eventTeams) ? input.eventTeams : [{ groupId: data.groupId, volunteersNeeded: 1 }];
    const teamRequirements: Array<{ groupId: string; volunteersNeeded: number }> = requirements.map((requirement: unknown) => {
      const value = requirement as Record<string, unknown>;
      const groupId = typeof value.groupId === "string" ? value.groupId.trim() : "";
      const volunteersNeeded = Number(value.volunteersNeeded ?? 1);
      if (!groupId || !Number.isInteger(volunteersNeeded) || volunteersNeeded < 1 || volunteersNeeded > 1000) {
        throw new MembershipVolunteerInputError("Each event team must have a valid group and volunteer count.");
      }
      return { groupId, volunteersNeeded };
    });
    const uniqueTeamRequirements: Array<{ groupId: string; volunteersNeeded: number }> = Array.from(new Map(teamRequirements.map((requirement) => [requirement.groupId, requirement] as const)).values());
    if (!uniqueTeamRequirements.length) return NextResponse.json({ error: "At least one volunteer team is required." }, { status: 400 });
    const groups = await db.membershipVolunteerGroup.findMany({ where: { id: { in: uniqueTeamRequirements.map((requirement: { groupId: string }) => requirement.groupId) } }, select: { id: true } });
    const group = groups.find((candidate) => candidate.id === data.groupId) ?? groups[0];
    if (!group || groups.length !== uniqueTeamRequirements.length) return NextResponse.json({ error: "One or more volunteer teams were not found." }, { status: 404 });
    if (!group) return NextResponse.json({ error: "Volunteer group not found." }, { status: 404 });
    const opportunity = await db.membershipServiceOpportunity.create({
      data: {
        ...data,
        groupId: group.id,
        title: data.title!,
        createdById: user.id,
        eventTeams: { create: uniqueTeamRequirements }
      },
      select
    });
    await logAudit({ activityType: "membership-service-opportunity-created", summary: `Created service opportunity “${opportunity.title}”.`, details: JSON.stringify({ opportunityId: opportunity.id, groupId: group.id }), actorId: user.id });
    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    if (error instanceof MembershipVolunteerInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to create service opportunity." }, { status: 500 });
  }
}
