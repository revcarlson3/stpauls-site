CREATE TYPE "BillingEnvironment" AS ENUM ('TEST', 'LIVE');

CREATE TABLE "BillingProviderConfiguration" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "environment" "BillingEnvironment" NOT NULL DEFAULT 'TEST',
    "stripeSecretKeyEncrypted" TEXT,
    "stripeWebhookSecretEncrypted" TEXT,
    "paypalClientIdEncrypted" TEXT,
    "paypalClientSecretEncrypted" TEXT,
    "paypalWebhookIdEncrypted" TEXT,
    "paypalApiBaseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingProviderConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingProviderConfiguration_provider_environment_key"
  ON "BillingProviderConfiguration"("provider", "environment");
