ALTER TABLE "Church" ADD COLUMN "publicSiteEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Church" ADD COLUMN "maintenanceMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SiteDomain" ADD COLUMN "registrarProvider" TEXT;
ALTER TABLE "SiteDomain" ADD COLUMN "registrarDetectedAt" TIMESTAMP(3);
ALTER TABLE "SiteDomain" ADD COLUMN "dnsGuidance" TEXT;
CREATE TABLE "NamecheapConfiguration" (
  "id" TEXT NOT NULL DEFAULT 'platform',
  "apiUserEncrypted" TEXT,
  "apiKeyEncrypted" TEXT,
  "usernameEncrypted" TEXT,
  "clientIp" TEXT,
  "domain" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NamecheapConfiguration_pkey" PRIMARY KEY ("id")
);
