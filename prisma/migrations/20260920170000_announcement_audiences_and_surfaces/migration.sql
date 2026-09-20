ALTER TABLE "GlobalAnnouncement"
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN "placement" TEXT NOT NULL DEFAULT 'AUTHENTICATED',
  ADD COLUMN "churchId" TEXT;

CREATE INDEX "GlobalAnnouncement_churchId_isActive_startsAt_endsAt_idx"
  ON "GlobalAnnouncement"("churchId", "isActive", "startsAt", "endsAt");

ALTER TABLE "GlobalAnnouncement"
  ADD CONSTRAINT "GlobalAnnouncement_churchId_fkey"
  FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
