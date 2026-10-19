ALTER TYPE "BillingInterval" ADD VALUE IF NOT EXISTS 'QUARTERLY';
ALTER TYPE "BillingInterval" ADD VALUE IF NOT EXISTS 'SEMI_ANNUAL';
ALTER TABLE "SubscriptionPlan" ADD COLUMN "price" DECIMAL(12,2);
ALTER TABLE "SubscriptionPlan" ADD COLUMN "interval" "BillingInterval";
ALTER TABLE "Promotion" ADD COLUMN "appliesQuarterly" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Promotion" ADD COLUMN "appliesSemiAnnual" BOOLEAN NOT NULL DEFAULT true;
