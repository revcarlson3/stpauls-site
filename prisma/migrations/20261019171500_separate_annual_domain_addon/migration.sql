ALTER TABLE "Subscription" ADD COLUMN "domainAddonPrice" DECIMAL(12,2);
ALTER TABLE "Subscription" ADD COLUMN "domainAddonHostname" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "domainAddonExternalId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "domainAddonStatus" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "domainAddonProvider" "BillingProvider";
