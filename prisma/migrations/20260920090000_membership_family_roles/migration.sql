DROP INDEX IF EXISTS "MembershipFamilyRole_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "MembershipFamilyRole_churchId_slug_key"
  ON "MembershipFamilyRole" ("churchId", "slug");
CREATE INDEX IF NOT EXISTS "MembershipFamilyRole_churchId_idx"
  ON "MembershipFamilyRole" ("churchId");

DO $$
DECLARE
  church_row record;
  role_row record;
BEGIN
  FOR church_row IN SELECT id FROM "Church" LOOP
    FOR role_row IN
      SELECT * FROM (VALUES
        ('head-of-household', 'Head of Household'),
        ('spouse', 'Spouse'),
        ('child', 'Child'),
        ('other', 'Other')
      ) AS defaults(slug, name)
    LOOP
      INSERT INTO "MembershipFamilyRole" ("id", "churchId", "slug", "name", "createdAt", "updatedAt")
      VALUES (md5(church_row.id || ':' || role_row.slug), church_row.id, role_row.slug, role_row.name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("churchId", "slug") DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
