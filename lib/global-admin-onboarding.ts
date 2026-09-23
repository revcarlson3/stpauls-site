import type { OnboardingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { buildGlobalAuditDetails, requireGlobalAdmin } from "@/lib/global-admin";

export const onboardingSteps = ["ACCOUNT", "SITE_IDENTITY", "MODULES", "SECURITY", "COMPLETE"] as const;
const ONBOARDING_PAGE_SIZE = 25;
export type OnboardingStep = (typeof onboardingSteps)[number];

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && onboardingSteps.includes(value as OnboardingStep);
}

export function validateOnboardingTransition(input: {
  currentStep: string;
  nextStep: unknown;
  siteIdentityDone: boolean;
  modulesDone: boolean;
  securityDone: boolean;
}) {
  if (!isOnboardingStep(input.nextStep)) return "Invalid onboarding step.";
  const nextStep = input.nextStep;
  const currentIndex = onboardingSteps.indexOf(input.currentStep as OnboardingStep);
  const nextIndex = onboardingSteps.indexOf(nextStep);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex > currentIndex + 1) return "Onboarding steps must advance in order.";
  if (nextStep === "MODULES" && !input.siteIdentityDone) return "Complete site identity before modules.";
  if (nextStep === "SECURITY" && (!input.siteIdentityDone || !input.modulesDone)) return "Complete site identity and modules before security.";
  if (nextStep === "COMPLETE" && (!input.siteIdentityDone || !input.modulesDone || !input.securityDone)) return "Complete all onboarding sections before finishing.";
  if (input.currentStep !== "ACCOUNT" && !input.siteIdentityDone && nextStep !== "ACCOUNT") return "Completed onboarding sections cannot be cleared.";
  return null;
}

export function onboardingStatusForStep(step: OnboardingStep): OnboardingStatus {
  if (step === "COMPLETE") return "COMPLETE";
  if (step === "ACCOUNT") return "PENDING_VERIFICATION";
  if (step === "SITE_IDENTITY") return "SITE_SETUP";
  return "IN_PROGRESS";
}

export function serializeOnboarding(record: { status: OnboardingStatus; currentStep: string; siteIdentityDone: boolean; modulesDone: boolean; securityDone: boolean; completedAt: Date | null }) {
  return { status: record.status, currentStep: record.currentStep, completion: { siteIdentity: record.siteIdentityDone, modules: record.modulesDone, security: record.securityDone, completedAt: record.completedAt?.toISOString() ?? null } };
}

export async function listGlobalOnboarding(input: { search?: string; status?: string; page?: number } = {}) {
  await requireGlobalAdmin();
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const search = input.search?.trim();
  const churches = await db.church.findMany({
    where: {
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { slug: { contains: search, mode: "insensitive" as const } }] } : {}),
      ...(input.status ? { onboardingStatus: input.status as OnboardingStatus } : {})
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, lifecycleStatus: true, onboardingStatus: true, onboardingStep: true, onboarding: { select: { status: true, currentStep: true, siteIdentityDone: true, modulesDone: true, securityDone: true, completedAt: true } } }
  });
  const total = churches.length;
  return { page, pageSize: ONBOARDING_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / ONBOARDING_PAGE_SIZE)), sites: churches.slice((page - 1) * ONBOARDING_PAGE_SIZE, page * ONBOARDING_PAGE_SIZE).map((site) => ({ site: { id: site.id, name: site.name, slug: site.slug, lifecycleStatus: site.lifecycleStatus }, onboarding: site.onboarding ? serializeOnboarding(site.onboarding) : null })) };
}

export async function updateGlobalOnboarding(input: { siteId: string; currentStep: unknown; siteIdentityDone: unknown; modulesDone: unknown; securityDone: unknown }) {
  const context = await requireGlobalAdmin({ sensitive: true });
  const current = await db.tenantOnboarding.findUnique({ where: { churchId: input.siteId }, select: { currentStep: true, siteIdentityDone: true, modulesDone: true, securityDone: true } });
  if (!current || typeof input.siteIdentityDone !== "boolean" || typeof input.modulesDone !== "boolean" || typeof input.securityDone !== "boolean") throw new Error("Invalid onboarding details.");
  if ((!input.siteIdentityDone && current.siteIdentityDone) || (!input.modulesDone && current.modulesDone) || (!input.securityDone && current.securityDone)) throw new Error("Completed onboarding sections cannot be cleared.");
  const transitionError = validateOnboardingTransition({ currentStep: current.currentStep, nextStep: input.currentStep, siteIdentityDone: input.siteIdentityDone, modulesDone: input.modulesDone, securityDone: input.securityDone });
  if (transitionError) throw new Error(transitionError);
  const step = input.currentStep as OnboardingStep;
  const siteIdentityDone = input.siteIdentityDone as boolean;
  const modulesDone = input.modulesDone as boolean;
  const securityDone = input.securityDone as boolean;
  return db.$transaction(async (transaction) => {
    const record = await transaction.tenantOnboarding.update({ where: { churchId: input.siteId }, data: { currentStep: step, status: onboardingStatusForStep(step), siteIdentityDone, modulesDone, securityDone, completedAt: step === "COMPLETE" ? new Date() : null }, select: { status: true, currentStep: true, siteIdentityDone: true, modulesDone: true, securityDone: true, completedAt: true } });
    await transaction.church.update({ where: { id: input.siteId }, data: { onboardingStatus: record.status, onboardingStep: record.currentStep } });
    await transaction.auditLog.create({ data: { activityType: "global-admin-onboarding-updated", summary: "Updated platform onboarding progress.", actorId: context.user.id, ...JSON.parse(buildGlobalAuditDetails({ churchId: input.siteId, targetType: "tenant-onboarding", targetId: input.siteId, metadata: { currentStep: record.currentStep, siteIdentityDone: record.siteIdentityDone, modulesDone: record.modulesDone, securityDone: record.securityDone } })) } });
    return serializeOnboarding(record);
  });
}

export async function getSelectedChurchOnboarding() {
  const context = await requireGlobalAdmin({ selectedChurch: true });
  const onboarding = await db.tenantOnboarding.findUnique({ where: { churchId: context.church!.id }, select: { status: true, currentStep: true, siteIdentityDone: true, modulesDone: true, securityDone: true, completedAt: true } });
  return onboarding ? serializeOnboarding(onboarding) : null;
}

export async function updateSelectedChurchOnboarding(input: { currentStep: unknown; siteIdentityDone: unknown; modulesDone: unknown; securityDone: unknown }) {
  const context = await requireGlobalAdmin({ selectedChurch: true, sensitive: true });
  const current = await db.tenantOnboarding.findUnique({ where: { churchId: context.church!.id }, select: { currentStep: true, siteIdentityDone: true, modulesDone: true, securityDone: true } });
  if (!current || typeof input.siteIdentityDone !== "boolean" || typeof input.modulesDone !== "boolean" || typeof input.securityDone !== "boolean") throw new Error("Invalid onboarding details.");
  if (input.siteIdentityDone === false && current.siteIdentityDone || input.modulesDone === false && current.modulesDone || input.securityDone === false && current.securityDone) throw new Error("Completed onboarding sections cannot be cleared.");
  const transitionError = validateOnboardingTransition({ currentStep: current.currentStep, nextStep: input.currentStep, siteIdentityDone: input.siteIdentityDone, modulesDone: input.modulesDone, securityDone: input.securityDone });
  if (transitionError) throw new Error(transitionError);
  const step = input.currentStep as OnboardingStep;
  const siteIdentityDone = input.siteIdentityDone as boolean;
  const modulesDone = input.modulesDone as boolean;
  const securityDone = input.securityDone as boolean;
  const updated = await db.$transaction(async (transaction) => {
    const record = await transaction.tenantOnboarding.update({
      where: { churchId: context.church!.id },
      data: { currentStep: step, status: onboardingStatusForStep(step), siteIdentityDone, modulesDone, securityDone, completedAt: step === "COMPLETE" ? new Date() : null },
      select: { status: true, currentStep: true, siteIdentityDone: true, modulesDone: true, securityDone: true, completedAt: true }
    });
    await transaction.church.update({ where: { id: context.church!.id }, data: { onboardingStatus: record.status, onboardingStep: record.currentStep } });
    await transaction.auditLog.create({
      data: {
        activityType: "global-admin-onboarding-updated",
        summary: "Updated selected-site onboarding progress.",
        actorId: context.user.id,
        ...JSON.parse(buildGlobalAuditDetails({ churchId: context.church!.id, targetType: "tenant-onboarding", targetId: context.church!.id, metadata: { currentStep: record.currentStep, siteIdentityDone: record.siteIdentityDone, modulesDone: record.modulesDone, securityDone: record.securityDone } }))
      }
    });
    return record;
  });
  return serializeOnboarding(updated);
}
