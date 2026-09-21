-- Backfill tenant ownership without deleting existing data. The active church
-- is preferred; the first church is used for legacy single-tenant databases.
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
    RAISE EXCEPTION 'No church exists for tenant backfill';
  END IF;

  ALTER TABLE "MembershipGradeAdvancementRun" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipGradeAdvancementRun" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipGradeAdvancementRun" ALTER COLUMN "churchId" SET NOT NULL;

  ALTER TABLE "MembershipFamily" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipFamily" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipFamily" ALTER COLUMN "churchId" SET NOT NULL;

  ALTER TABLE "MembershipIndividual" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipIndividual" i SET "churchId" = f."churchId"
    FROM "MembershipFamily" f WHERE i."familyId" = f.id AND i."churchId" IS NULL;
  UPDATE "MembershipIndividual" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipIndividual" ALTER COLUMN "churchId" SET NOT NULL;

  ALTER TABLE "MembershipEvent" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipEvent" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipEvent" ALTER COLUMN "churchId" SET NOT NULL;

  ALTER TABLE "MembershipFamilyRole" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipFamilyRole" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipFamilyRole" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "MembershipWorkflow" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipWorkflow" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipWorkflow" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "MembershipMemberType" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipMemberType" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipMemberType" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "MembershipVolunteerGroup" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipVolunteerGroup" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipVolunteerGroup" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "MembershipManualList" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipManualList" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipManualList" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "MembershipDynamicList" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipDynamicList" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipDynamicList" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "MembershipCustomFieldDefinition" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipCustomFieldDefinition" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipCustomFieldDefinition" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "MembershipMessageTemplate" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipMessageTemplate" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipMessageTemplate" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "MembershipMessage" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipMessage" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipMessage" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "MembershipReport" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipReport" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipReport" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "ReportAutomation" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "ReportAutomation" r SET "churchId" = m."churchId"
    FROM "MembershipReport" m WHERE r."reportId" = m.id AND r."churchId" IS NULL;
  UPDATE "ReportAutomation" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "ReportAutomation" ALTER COLUMN "churchId" SET NOT NULL;
  ALTER TABLE "MembershipDashboardPreference" ADD COLUMN IF NOT EXISTS "churchId" text;
  UPDATE "MembershipDashboardPreference" SET "churchId" = fallback_church WHERE "churchId" IS NULL;
  ALTER TABLE "MembershipDashboardPreference" ALTER COLUMN "churchId" SET NOT NULL;
END $$;

-- Foreign keys and lookup indexes are deliberately separate from the backfill
-- block so re-running a partially applied deployment remains safe.
DO $$
DECLARE model_name text;
BEGIN
  FOREACH model_name IN ARRAY ARRAY[
    'MembershipGradeAdvancementRun','MembershipFamily','MembershipIndividual',
    'MembershipEvent','MembershipFamilyRole','MembershipWorkflow',
    'MembershipMemberType','MembershipVolunteerGroup','MembershipManualList',
    'MembershipDynamicList','MembershipCustomFieldDefinition',
    'MembershipMessageTemplate','MembershipMessage','MembershipReport',
    'ReportAutomation','MembershipDashboardPreference'
  ] LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON "%s" ("churchId")',
      model_name || '_churchId_idx', model_name);
    BEGIN
      EXECUTE format('ALTER TABLE "%s" ADD CONSTRAINT %I FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE',
        model_name, model_name || '_churchId_fkey');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
