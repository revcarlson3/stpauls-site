ALTER TABLE "SiteDomain"
ADD COLUMN "tlsCertificateId" INTEGER;

ALTER TABLE "OnePanelConfiguration"
ADD COLUMN "websiteId" INTEGER,
ADD COLUMN "acmeAccountId" INTEGER,
ADD COLUMN "wildcardSslId" INTEGER,
ADD COLUMN "platformSuffix" TEXT NOT NULL DEFAULT 'mychurch.one';
