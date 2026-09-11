import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireEnabledModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

function valueForStep(step: { value?: string }) {
  return step.value ?? "";
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requirePermission("MANAGE_MEMBERSHIP");
    await requireEnabledModule("membership", user.id, "MANAGE_MEMBERSHIP");
    const input = await request.json();
    const workflow = await db.membershipWorkflow.findUnique({ where: { id: params.id } });
    if (!workflow || !workflow.isActive) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    if (typeof input?.targetId !== "string") return NextResponse.json({ error: "Choose a member or family first." }, { status: 400 });
    const allSteps = Array.isArray(workflow.steps) ? workflow.steps as { type?: string; value?: string; field?: string; operation?: string; reason?: string }[] : [];
    const requestedStepIndex = Number.isInteger(input?.stepIndex) ? input.stepIndex : null;
    const steps = requestedStepIndex === null ? allSteps : allSteps.slice(requestedStepIndex, requestedStepIndex + 1);
    if (!steps.length || (requestedStepIndex !== null && (requestedStepIndex < 0 || requestedStepIndex >= allSteps.length))) return NextResponse.json({ error: "Workflow step not found." }, { status: 400 });
    const data: Record<string, unknown> = {};
    const notePrompts: { reason: string; body: string }[] = [];
    const currentRecord = workflow.targetType === "INDIVIDUAL"
      ? await db.membershipIndividual.findUnique({ where: { id: input.targetId } })
      : await db.membershipFamily.findUnique({ where: { id: input.targetId } });
    if (!currentRecord) return NextResponse.json({ error: "The selected workflow target was not found." }, { status: 404 });
    for (const step of steps) {
      if (step.type === "status" && ["ACTIVE", "INACTIVE", "DECEASED"].includes((step.value ?? "").trim().toUpperCase())) data.status = (step.value ?? "").trim().toUpperCase();
      if (step.type === "memberType" && step.value) data.memberTypeId = step.value;
      if (step.type === "familyRole" && step.value) data.familyRoleId = step.value;
      if (step.type === "directoryListed") data.directoryListed = step.value !== "false";
      if (step.type === "removePhotograph") data.photographUrl = null;
      if (step.type === "field" && typeof step.field === "string") {
        const field = step.field;
        const operation = step.operation ?? "set";
        const value = typeof step.value === "string" ? step.value : "";
        const allowedIndividual = ["firstName", "middleName", "lastName", "email", "cellphone", "otherPhone", "otherPhoneType", "relationshipNotes", "communicationNotes", "gradeLevel", "maritalStatus", "ageCategoryOverride", "envelopeNumber", "emailMessagesAllowed", "smsMessagesAllowed", "preferredContactMethod", "doNotContact", "photographUrl"];
        const allowedFamily = ["lastName", "familyNameOverride", "email", "phone", "phoneIsMobile", "addressStreet", "addressCity", "addressState", "addressZip", "secondaryStreet", "secondaryCity", "secondaryState", "secondaryZip", "secondaryIsMailing", "formalGreeting", "informalGreeting", "photographUrl"];
        if ((workflow.targetType === "INDIVIDUAL" ? allowedIndividual : allowedFamily).includes(field)) {
          if (operation === "clear") data[field] = null;
          else if (operation === "append") data[field] = `${typeof currentRecord[field as keyof typeof currentRecord] === "string" ? currentRecord[field as keyof typeof currentRecord] : ""}${value}`;
          else data[field] = ["emailMessagesAllowed", "smsMessagesAllowed", "doNotContact", "phoneIsMobile", "secondaryIsMailing"].includes(field) ? value === "true" : value;
        }
      }
      if (step.type === "notePrompt") notePrompts.push({ reason: step.reason || "Workflow note", body: valueForStep(step) });
    }
    const notes = Array.isArray(input.notes) ? input.notes.filter((note: unknown): note is { reason: string; body: string } => Boolean(note && typeof note === "object" && typeof (note as { body?: unknown }).body === "string")).map((note: { reason: string; body: string }) => ({ reason: note.reason || "Workflow note", body: note.body })) : [];
    if (workflow.targetType === "INDIVIDUAL") {
      if (!Object.keys(data).length && !notePrompts.length && !notes.length) return NextResponse.json({ error: "This workflow has no supported changes." }, { status: 400 });
      await db.$transaction(async (transaction) => {
        await transaction.membershipIndividual.update({ where: { id: input.targetId }, data });
        for (const note of [...notePrompts, ...notes]) await transaction.membershipNote.create({ data: { individualId: input.targetId, authorId: user.id, reason: note.reason, body: note.body } });
      });
    } else {
      if (!data.status) return NextResponse.json({ error: "Family workflows currently support a status step." }, { status: 400 });
      await db.membershipFamily.update({ where: { id: input.targetId }, data: { status: data.status as "ACTIVE" | "INACTIVE" } });
    }
    await logAudit({ activityType: "membership-individual-updated", summary: `Applied workflow ${workflow.name}.`, details: JSON.stringify({ workflowId: workflow.id, targetId: input.targetId }), actorId: user.id });
    return NextResponse.json({ applied: true });
  } catch {
    return NextResponse.json({ error: "Unable to apply workflow." }, { status: 400 });
  }
}
