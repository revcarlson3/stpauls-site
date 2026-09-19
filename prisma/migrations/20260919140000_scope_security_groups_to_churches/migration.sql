-- Security groups were historically global. A group used by users in more than
-- one Church cannot be assigned safely, so this migration aborts instead of
-- silently choosing a tenant. Groups with no assignments use the oldest active
-- Church as a documented legacy fallback.
DO $$
DECLARE
  fallback_church text;
  group_row record;
  church_count integer;
  church_id text;
BEGIN
  SELECT id INTO fallback_church FROM "Church"
    WHERE status = 'ACTIVE' ORDER BY "createdAt" LIMIT 1;
  IF fallback_church IS NULL THEN
    SELECT id INTO fallback_church FROM "Church"
      ORDER BY "createdAt" LIMIT 1;
  END IF;
  IF fallback_church IS NULL THEN
    RAISE EXCEPTION 'Cannot scope security groups: no Church exists';
  END IF;

  ALTER TABLE "SecurityGroup" ADD COLUMN IF NOT EXISTS "churchId" text;

  FOR group_row IN SELECT id FROM "SecurityGroup" LOOP
    SELECT COUNT(DISTINCT cu."churchId"), MIN(cu."churchId")
      INTO church_count, church_id
      FROM "User" u
      JOIN "ChurchUser" cu ON cu."userId" = u.id
      WHERE u."groupId" = group_row.id;
    IF EXISTS (
      SELECT 1 FROM "User" u
      WHERE u."groupId" = group_row.id
        AND NOT EXISTS (SELECT 1 FROM "ChurchUser" cu WHERE cu."userId" = u.id)
    ) THEN
      RAISE EXCEPTION 'Cannot scope security group %: assigned user has no Church membership', group_row.id;
    END IF;
    IF church_count > 1 THEN
      RAISE EXCEPTION 'Cannot scope security group %: assigned users belong to multiple Churches', group_row.id;
    ELSIF church_count = 1 THEN
      UPDATE "SecurityGroup" SET "churchId" = church_id WHERE id = group_row.id;
    ELSE
      UPDATE "SecurityGroup" SET "churchId" = fallback_church WHERE id = group_row.id;
    END IF;
  END LOOP;

  ALTER TABLE "SecurityGroup" ALTER COLUMN "churchId" SET NOT NULL;
  DROP INDEX IF EXISTS "SecurityGroup_slug_key";
  CREATE UNIQUE INDEX IF NOT EXISTS "SecurityGroup_churchId_slug_key"
    ON "SecurityGroup" ("churchId", "slug");
  CREATE INDEX IF NOT EXISTS "SecurityGroup_churchId_idx"
    ON "SecurityGroup" ("churchId");
  ALTER TABLE "SecurityGroup" ADD CONSTRAINT "SecurityGroup_churchId_fkey"
    FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE "UserInvitation" ADD COLUMN IF NOT EXISTS "churchId" text;
  IF EXISTS (
    SELECT 1
    FROM "UserInvitation" i
    WHERE NOT EXISTS (SELECT 1 FROM "ChurchUser" cu WHERE cu."userId" = i."createdById")
  ) THEN
    RAISE EXCEPTION 'Cannot scope invitations: an invitation creator has no Church membership';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "UserInvitation" i
    JOIN "ChurchUser" cu ON cu."userId" = i."createdById"
    GROUP BY i.id
    HAVING COUNT(DISTINCT cu."churchId") > 1
  ) THEN
    RAISE EXCEPTION 'Cannot scope invitations: an invitation creator belongs to multiple Churches';
  END IF;
  UPDATE "UserInvitation" i
    SET "churchId" = cu."churchId"
    FROM "ChurchUser" cu
    WHERE cu."userId" = i."createdById";
  ALTER TABLE "UserInvitation" ALTER COLUMN "churchId" SET NOT NULL;
  CREATE INDEX IF NOT EXISTS "UserInvitation_churchId_acceptedAt_idx"
    ON "UserInvitation" ("churchId", "acceptedAt");
  ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_churchId_fkey"
    FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END $$;
