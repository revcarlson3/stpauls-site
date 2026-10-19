CREATE TYPE "PlanEntitlementMode" AS ENUM ('DISABLED', 'INCLUDED', 'PAID_ADD_ON');

CREATE TABLE "SubscriptionPlanEntitlement" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "mode" "PlanEntitlementMode" NOT NULL DEFAULT 'INCLUDED',
    "addOnMonthly" DECIMAL(12,2),
    "addOnAnnual" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPlanEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlanEntitlement_planId_moduleSlug_key" ON "SubscriptionPlanEntitlement"("planId", "moduleSlug");
CREATE INDEX "SubscriptionPlanEntitlement_moduleSlug_mode_idx" ON "SubscriptionPlanEntitlement"("moduleSlug", "mode");
ALTER TABLE "SubscriptionPlanEntitlement" ADD CONSTRAINT "SubscriptionPlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
