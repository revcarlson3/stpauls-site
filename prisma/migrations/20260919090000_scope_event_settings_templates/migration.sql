-- Scope legacy event settings and notification templates to a church.
DO $$
DECLARE fallback_church text;
BEGIN
  SELECT id INTO fallback_church FROM "Church"
    WHERE status = 'ACTIVE' ORDER BY "createdAt" LIMIT 1;
  IF fallback_church IS NULL THEN
    SELECT id INTO fallback_church FROM "Church"
      ORDER BY "createdAt" LIMIT 1;
  END IF;
  IF fallback_church IS NULL THEN
    RAISE EXCEPTION 'No church exists for event settings backfill';
  END IF;

  ALTER TABLE "MembershipEventSettings" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipEventSettings" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipEventSettings" ALTER COLUMN "churchId" SET NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS "MembershipEventSettings_churchId_key"
    ON "MembershipEventSettings" ("churchId");
  BEGIN
    ALTER TABLE "MembershipEventSettings" ADD CONSTRAINT "MembershipEventSettings_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  ALTER TABLE "MembershipEventNotificationTemplate" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipEventNotificationTemplate" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipEventNotificationTemplate" ALTER COLUMN "churchId" SET NOT NULL;
  CREATE INDEX IF NOT EXISTS "MembershipEventNotificationTemplate_churchId_idx"
    ON "MembershipEventNotificationTemplate" ("churchId");
  BEGIN
    ALTER TABLE "MembershipEventNotificationTemplate" ADD CONSTRAINT "MembershipEventNotificationTemplate_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
