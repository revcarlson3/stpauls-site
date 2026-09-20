DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'GlobalAnnouncement'
      AND column_name = 'audience'
  ) THEN
    ALTER TABLE "GlobalAnnouncement" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'GLOBAL';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'GlobalAnnouncement'
      AND column_name = 'placement'
  ) THEN
    ALTER TABLE "GlobalAnnouncement" ADD COLUMN "placement" TEXT NOT NULL DEFAULT 'AUTHENTICATED';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'GlobalAnnouncement'
      AND column_name = 'churchId'
  ) THEN
    ALTER TABLE "GlobalAnnouncement" ADD COLUMN "churchId" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "GlobalAnnouncement_churchId_isActive_startsAt_endsAt_idx"
  ON "GlobalAnnouncement"("churchId", "isActive", "startsAt", "endsAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GlobalAnnouncement_churchId_fkey'
      AND conrelid = '"GlobalAnnouncement"'::regclass
  ) THEN
    ALTER TABLE "GlobalAnnouncement"
      ADD CONSTRAINT "GlobalAnnouncement_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
