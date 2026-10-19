ALTER TABLE "SiteDomain"
ALTER COLUMN "tlsCertificateId" TYPE TEXT USING "tlsCertificateId"::TEXT;

ALTER TABLE "OnePanelConfiguration"
ALTER COLUMN "websiteId" TYPE TEXT USING "websiteId"::TEXT,
ALTER COLUMN "acmeAccountId" TYPE TEXT USING "acmeAccountId"::TEXT,
ALTER COLUMN "wildcardSslId" TYPE TEXT USING "wildcardSslId"::TEXT;
