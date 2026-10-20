-- Tenant isolation for public pages, media, and site identity.
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "churchId" TEXT;

CREATE TABLE IF NOT EXISTS "SiteIdentity" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL DEFAULT 'St. Paul''s',
    "siteUrl" TEXT NOT NULL DEFAULT '',
    "siteTagline" TEXT NOT NULL DEFAULT 'A place to belong.',
    "siteAddressStreet" TEXT NOT NULL DEFAULT '',
    "siteAddressCity" TEXT NOT NULL DEFAULT '',
    "siteAddressState" TEXT NOT NULL DEFAULT '',
    "siteAddressZip" TEXT NOT NULL DEFAULT '',
    "sitePhone" TEXT NOT NULL DEFAULT '',
    "siteEmail" TEXT NOT NULL DEFAULT '',
    "siteTaxId" TEXT NOT NULL DEFAULT '',
    "siteLogoUrl" TEXT NOT NULL DEFAULT '',
    "siteLogoLightUrl" TEXT NOT NULL DEFAULT '',
    "siteLogoDarkUrl" TEXT NOT NULL DEFAULT '',
    "siteFaviconUrl" TEXT NOT NULL DEFAULT '',
    "siteShowTitle" BOOLEAN NOT NULL DEFAULT true,
    "siteShowTagline" BOOLEAN NOT NULL DEFAULT true,
    "siteShowLogo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteIdentity_pkey" PRIMARY KEY ("id")
);

-- Existing records predate tenant ownership. Assign them deterministically to
-- the earliest church while retaining all values; later tenant records are
-- created through the tenant-scoped APIs.
DO $$
DECLARE
  fallback_church TEXT;
BEGIN
  SELECT "id" INTO fallback_church FROM "Church" ORDER BY "createdAt", "id" LIMIT 1;
  IF fallback_church IS NOT NULL THEN
    UPDATE "Page" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
    UPDATE "MediaAsset" SET "churchId" = COALESCE(
      (SELECT cu."churchId" FROM "ChurchUser" cu WHERE cu."userId" = "MediaAsset"."uploaderId" ORDER BY cu."createdAt", cu."churchId" LIMIT 1),
      fallback_church
    ) WHERE "churchId" IS NULL;
    INSERT INTO "SiteIdentity" (
      "id", "churchId", "siteName", "siteUrl", "siteTagline",
      "siteAddressStreet", "siteAddressCity", "siteAddressState",
      "siteAddressZip", "sitePhone", "siteEmail", "siteTaxId",
      "siteLogoUrl", "siteLogoLightUrl", "siteLogoDarkUrl", "siteFaviconUrl",
      "siteShowTitle", "siteShowTagline", "siteShowLogo", "updatedAt"
    )
    SELECT
      'legacy-' || fallback_church, fallback_church, COALESCE(s."siteName", 'St. Paul''s'),
      COALESCE(s."siteUrl", ''), COALESCE(s."siteTagline", 'A place to belong.'),
      COALESCE(s."siteAddressStreet", ''), COALESCE(s."siteAddressCity", ''),
      COALESCE(s."siteAddressState", ''), COALESCE(s."siteAddressZip", ''),
      COALESCE(s."sitePhone", ''), COALESCE(s."siteEmail", ''), COALESCE(s."siteTaxId", ''),
      COALESCE(s."siteLogoUrl", ''), COALESCE(s."siteLogoLightUrl", ''),
      COALESCE(s."siteLogoDarkUrl", ''), COALESCE(s."siteFaviconUrl", ''),
      COALESCE(s."siteShowTitle", true), COALESCE(s."siteShowTagline", true),
      COALESCE(s."siteShowLogo", false), CURRENT_TIMESTAMP
    FROM "SecuritySettings" s
    WHERE s."id" = 1
      AND NOT EXISTS (
        SELECT 1 FROM "SiteIdentity" existing WHERE existing."churchId" = fallback_church
      );
  END IF;
END $$;

ALTER TABLE "Page" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "MediaAsset" ALTER COLUMN "churchId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Page_churchId_status_idx" ON "Page"("churchId", "status");
CREATE INDEX IF NOT EXISTS "MediaAsset_churchId_createdAt_idx" ON "MediaAsset"("churchId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SiteIdentity_churchId_key" ON "SiteIdentity"("churchId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Page_churchId_fkey') THEN
    ALTER TABLE "Page" ADD CONSTRAINT "Page_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MediaAsset_churchId_fkey') THEN
    ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteIdentity_churchId_fkey') THEN
    ALTER TABLE "SiteIdentity" ADD CONSTRAINT "SiteIdentity_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
