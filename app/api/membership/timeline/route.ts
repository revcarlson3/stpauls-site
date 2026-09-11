import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { MembershipTimelineItem, recordTimelineItems, sortTimelineItems } from "@/lib/membership-timeline";
import { requireEnabledModule } from "@/lib/modules";

type AuditRecord = {
  id: string;
  activityType: string;
  summary: string;
  createdAt: Date;
  details: string | null;
  actor: { name: string; email: string } | null;
};

type TimelineMember = {
  id: string;
  firstName: string;
  lastName: string | null;
  family: { lastName: string };
  createdAt: Date;
  updatedAt: Date;
  notes: {
    id: string;
    reason: string;
    body: string;
    createdAt: Date;
    updatedAt: Date;
    author: { name: string };
  }[];
  volunteerAssignmentHistory: {
    id: string;
    action: string;
    role: string | null;
    isLeader: boolean | null;
    createdAt: Date;
    group: { name: string };
    changedBy: { name: string } | null;
  }[];
};

function memberName(member: Pick<TimelineMember, "firstName" | "lastName" | "family">) {
  return `${member.firstName} ${member.lastName ?? member.family.lastName}`;
}

function auditTimelineItems(audits: AuditRecord[], members: TimelineMember[] = []): MembershipTimelineItem[] {
  return audits.map((audit) => {
    const member = members.find((candidate) => audit.details?.includes(candidate.id));
    return {
      id: `audit-${audit.id}`,
      type: "audit",
      title: audit.summary,
      occurredAt: audit.createdAt.toISOString(),
      actor: audit.actor?.name ?? audit.actor?.email ?? null,
      individualId: member?.id,
      individualName: member ? memberName(member) : undefined
    };
  });
}

function individualTimelineItems(member: TimelineMember, audits: AuditRecord[] = []) {
  const name = memberName(member);
  const subject = { individualId: member.id, individualName: name };
  const notes = member.notes.flatMap<MembershipTimelineItem>((note) => {
    const items: MembershipTimelineItem[] = [{
      ...subject,
      id: `note-created-${note.id}`,
      type: "note",
      title: note.reason,
      description: note.body,
      occurredAt: note.createdAt.toISOString(),
      actor: note.author.name
    }];
    if (note.updatedAt.getTime() > note.createdAt.getTime() + 1000) {
      items.push({
        ...subject,
        id: `note-updated-${note.id}`,
        type: "note",
        title: `Note updated: ${note.reason}`,
        occurredAt: note.updatedAt.toISOString(),
        actor: note.author.name
      });
    }
    return items;
  });
  const assignments: MembershipTimelineItem[] = member.volunteerAssignmentHistory.map((assignment) => ({
    ...subject,
    id: `volunteer-${assignment.id}`,
    type: "volunteer",
    title: `${assignment.action === "REMOVED" ? "Removed from" : assignment.action === "ASSIGNED" ? "Assigned to" : "Updated assignment in"} ${assignment.group.name}`,
    description: [assignment.role, assignment.isLeader ? "Leader" : null].filter(Boolean).join(" · ") || null,
    occurredAt: assignment.createdAt.toISOString(),
    actor: assignment.changedBy?.name ?? null
  }));
  return sortTimelineItems([
    ...recordTimelineItems({
      id: member.id,
      label: "Individual record",
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      ...subject
    }),
    ...notes,
    ...assignments,
    ...auditTimelineItems(audits, [member])
  ]);
}

async function findAudits(ids: string[]) {
  if (!ids.length) return [];
  return db.auditLog.findMany({
    where: {
      activityType: { startsWith: "membership-" },
      OR: ids.map((id) => ({ details: { contains: id } }))
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      activityType: true,
      summary: true,
      details: true,
      createdAt: true,
      actor: { select: { name: true, email: true } }
    }
  });
}

export async function GET(request: Request) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const searchParams = new URL(request.url).searchParams;
    const individualId = searchParams.get("individualId")?.trim() ?? "";
    const familyId = searchParams.get("familyId")?.trim() ?? "";
    if ((!individualId && !familyId) || (individualId && familyId)) {
      return NextResponse.json({ error: "Provide either an individual or family ID." }, { status: 400 });
    }

    if (individualId) {
      const individual = await db.membershipIndividual.findUnique({
        where: { id: individualId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          family: { select: { lastName: true } },
          createdAt: true,
          updatedAt: true,
          notes: {
            orderBy: { createdAt: "desc" },
            select: { id: true, reason: true, body: true, createdAt: true, updatedAt: true, author: { select: { name: true } } }
          },
          volunteerAssignmentHistory: {
            orderBy: { createdAt: "desc" },
            select: { id: true, action: true, role: true, isLeader: true, createdAt: true, group: { select: { name: true } }, changedBy: { select: { name: true } } }
          }
        }
      });
      if (!individual) return NextResponse.json({ error: "Individual not found." }, { status: 404 });
      const audits = await findAudits([individual.id]);
      return NextResponse.json({
        target: { type: "individual", id: individual.id, name: memberName(individual) },
        timeline: individualTimelineItems(individual, audits)
      });
    }

    const family = await db.membershipFamily.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        lastName: true,
        familyNameOverride: true,
        createdAt: true,
        updatedAt: true,
        documents: {
          orderBy: { createdAt: "desc" },
          select: { id: true, originalName: true, createdAt: true, mimeType: true, sizeBytes: true }
        },
        individuals: {
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            family: { select: { lastName: true } },
            createdAt: true,
            updatedAt: true,
            notes: {
              orderBy: { createdAt: "desc" },
              select: { id: true, reason: true, body: true, createdAt: true, updatedAt: true, author: { select: { name: true } } }
            },
            volunteerAssignmentHistory: {
              orderBy: { createdAt: "desc" },
              select: { id: true, action: true, role: true, isLeader: true, createdAt: true, group: { select: { name: true } }, changedBy: { select: { name: true } } }
            }
          }
        }
      }
    });
    if (!family) return NextResponse.json({ error: "Family not found." }, { status: 404 });

    const audits = await findAudits([family.id, ...family.individuals.map((individual) => individual.id)]);
    const memberTimelines = family.individuals.map((individual) => ({
      individualId: individual.id,
      name: memberName(individual),
      timeline: individualTimelineItems(
        individual,
        audits.filter((audit) => audit.details?.includes(individual.id))
      )
    }));
    const documents: MembershipTimelineItem[] = family.documents.map((document) => ({
      id: `document-${document.id}`,
      type: "document",
      title: `Document uploaded: ${document.originalName}`,
      description: `${document.mimeType} · ${document.sizeBytes.toLocaleString()} bytes`,
      occurredAt: document.createdAt.toISOString(),
      document: {
        id: document.id,
        name: document.originalName,
        downloadUrl: `/api/membership/families/${family.id}/documents/${document.id}`
      }
    }));
    const directFamilyAudits = audits.filter((audit) => audit.details?.includes(family.id));
    const familyItems = [
      ...recordTimelineItems({
        id: family.id,
        label: "Family record",
        createdAt: family.createdAt,
        updatedAt: family.updatedAt
      }),
      ...documents,
      ...auditTimelineItems(directFamilyAudits)
    ];
    return NextResponse.json({
      target: { type: "family", id: family.id, name: family.familyNameOverride ?? `${family.lastName} family` },
      timeline: sortTimelineItems([...familyItems, ...memberTimelines.flatMap((member) => member.timeline)]),
      members: memberTimelines,
      documents: family.documents.map((document) => ({
        ...document,
        downloadUrl: `/api/membership/families/${family.id}/documents/${document.id}`
      }))
    });
  } catch {
    return NextResponse.json({ error: "Unable to load membership timeline." }, { status: 403 });
  }
}
