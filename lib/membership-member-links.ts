import { db } from "@/lib/db";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyMemberLinkDecision, notifyMemberLinkRequested } from "@/lib/user-notifications";

export const MEMBER_EDITABLE_FIELDS = [
  ["firstName", "First name"], ["middleName", "Middle name"], ["calledByName", "Called by name"], ["lastName", "Last name"], ["email", "Email"],
  ["cellphone", "Cell phone"], ["otherPhone", "Other phone"],
  ["weddingDate", "Wedding date"], ["deceasedDate", "Deceased date"],
  ["addressStreet", "Address line 1"], ["secondaryStreet", "Address line 2"],
  ["addressCity", "City"], ["addressState", "State"], ["addressZip", "ZIP code"],
  ["familyPhone", "Family phone"], ["familyEmail", "Family email"], ["familyPhotographUrl", "Family photograph"]
] as const;

export async function ensureEditableFields() {
  const definitions = await db.membershipCustomFieldDefinition.findMany({
    where: { isActive: true, appliesTo: { in: ["INDIVIDUAL", "FAMILY"] } },
    orderBy: [{ appliesTo: "asc" }, { position: "asc" }, { name: "asc" }]
  });
  await db.$transaction(MEMBER_EDITABLE_FIELDS.map(([fieldKey, label], position) =>
    db.membershipEditableField.upsert({ where: { fieldKey }, create: { fieldKey, label, position }, update: { label, position } })
  ));
  await db.$transaction(definitions.map((definition, index) => {
    const target = definition.appliesTo === "FAMILY" ? "Family" : "Individual";
    return db.membershipEditableField.upsert({
      where: { fieldKey: `customField:${definition.id}` },
      create: { fieldKey: `customField:${definition.id}`, label: `${target}: ${definition.name}`, position: MEMBER_EDITABLE_FIELDS.length + index },
      update: { label: `${target}: ${definition.name}`, position: MEMBER_EDITABLE_FIELDS.length + index }
    });
  }));
  return db.membershipEditableField.findMany({ orderBy: { position: "asc" } });
}

export async function requestMemberLink() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: sign-in required.");
  const existingLink = await db.membershipUserMemberLink.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (existingLink) return { status: "APPROVED" as const };
  const existingRequest = await db.membershipLinkRequest.findFirst({ where: { userId: user.id, status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (existingRequest) return { status: "PENDING" as const };
  const account = await db.user.findUnique({ where: { id: user.id }, select: { email: true } });
  if (!account) throw new Error("Account not found.");
  const nameParts = user.name.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() ?? user.name;
  const lastName = nameParts.join(" ") || firstName;
  const request = await db.membershipLinkRequest.create({
    data: { userId: user.id, requestedFirstName: firstName, requestedLastName: lastName, requestedEmail: account.email }
  });
  await notifyMemberLinkRequested({ name: user.name, email: account.email, createdAt: request.createdAt });
  await logAudit({ activityType: "user-updated", summary: `${user.name} requested membership access.`, actorId: user.id });
  return { status: "PENDING" as const };
}

function score(request: { requestedFirstName: string; requestedLastName: string; requestedEmail: string }, individual: { firstName: string; lastName: string | null; email: string | null }) {
  let value = 0;
  if (individual.email?.toLowerCase() === request.requestedEmail.toLowerCase()) value += 100;
  if (individual.firstName.toLowerCase() === request.requestedFirstName.toLowerCase()) value += 30;
  if (individual.lastName?.toLowerCase() === request.requestedLastName.toLowerCase()) value += 30;
  return value;
}

export async function listMemberLinkRequests() {
  await requirePermission("MANAGE_USERS");
  const requests = await db.membershipLinkRequest.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { id: true, name: true, email: true, emailVerifiedAt: true } }, matchedIndividual: { include: { family: true, memberLink: { include: { user: { select: { name: true, email: true } } } } } } },
    orderBy: { createdAt: "asc" }
  });
  const individuals = await db.membershipIndividual.findMany({ include: { family: true, memberLink: { include: { user: { select: { name: true, email: true } } } } } });
  return requests.map((request) => {
    const candidates = individuals.map((individual) => ({ individual, score: score(request, individual) })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
    const best = candidates[0]?.individual ?? request.matchedIndividual;
    return { ...request, suggestedMatch: best ? { ...best, matchScore: candidates[0]?.score ?? 0 } : null };
  });
}

export async function reviewMemberLinkRequest(requestId: string, action: "approve" | "decline", individualId?: string, override = false) {
  const reviewer = await requirePermission("MANAGE_USERS");
  const request = await db.membershipLinkRequest.findUnique({ where: { id: requestId }, include: { user: true } });
  if (!request || request.status !== "PENDING") throw new Error("Membership link request is no longer pending.");
  if (action === "decline") {
    await db.membershipLinkRequest.update({ where: { id: requestId }, data: { status: "DECLINED", reviewedById: reviewer.id, reviewedAt: new Date() } });
    await notifyMemberLinkDecision({ email: request.user.email, approved: false });
    return { status: "DECLINED" };
  }
  if (!individualId) throw new Error("Choose a member record before approving.");
  const individual = await db.membershipIndividual.findUnique({ where: { id: individualId }, include: { family: true } });
  if (!individual) throw new Error("Member record not found.");
  await db.$transaction(async (tx) => {
    const churchMemberGroup = await tx.securityGroup.findFirst({ where: { churchId: individual.churchId, slug: "church-member" }, select: { id: true } });
    if (!churchMemberGroup) throw new Error("The Church Member security group has not been initialized.");
    const existing = await tx.membershipUserMemberLink.findUnique({ where: { individualId }, include: { user: true } });
    if (existing && !override) throw new Error("This member record is already linked to another user.");
    if (existing) await tx.membershipUserMemberLink.delete({ where: { id: existing.id } });
    const prior = await tx.membershipUserMemberLink.findUnique({ where: { userId: request.userId } });
    if (prior) await tx.membershipUserMemberLink.delete({ where: { id: prior.id } });
    await tx.membershipUserMemberLink.create({ data: { userId: request.userId, individualId, linkedById: reviewer.id } });
    if (request.user.role !== "admin") {
      await tx.user.update({ where: { id: request.userId }, data: { groupId: churchMemberGroup.id } });
    }
    await tx.membershipLinkRequest.update({ where: { id: requestId }, data: { status: "APPROVED", matchedIndividualId: individualId, reviewedById: reviewer.id, reviewedAt: new Date() } });
  });
  await logAudit({ actorId: reviewer.id, activityType: "membership-individual-updated", summary: `Linked ${request.user.name} to ${individual.firstName} ${individual.lastName}.` });
  await notifyMemberLinkDecision({ email: request.user.email, approved: true, memberName: `${individual.firstName} ${individual.lastName}` });
  return { status: "APPROVED" };
}
