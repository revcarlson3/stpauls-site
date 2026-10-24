ALTER TABLE "WorshipServiceHymn" ADD COLUMN "hymnId" TEXT;
ALTER TABLE "WorshipServiceHymn" ADD COLUMN "custom" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "WorshipHymnal" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorshipHymnal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorshipServiceSettings" (
  "id" SERIAL NOT NULL,
  "churchId" TEXT NOT NULL,
  "primaryHymnalId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorshipServiceSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorshipHymn" (
  "id" TEXT NOT NULL,
  "hymnalId" TEXT NOT NULL,
  "number" TEXT,
  "title" TEXT NOT NULL,
  "firstLine" TEXT,
  "tuneName" TEXT,
  "tuneAuthors" TEXT,
  "textAuthors" TEXT,
  "copyrightInfo" TEXT,
  "sourceUrl" TEXT NOT NULL,
  CONSTRAINT "WorshipHymn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorshipHymnal_churchId_code_key" ON "WorshipHymnal"("churchId", "code");
CREATE INDEX "WorshipHymnal_churchId_idx" ON "WorshipHymnal"("churchId");
CREATE UNIQUE INDEX "WorshipServiceSettings_churchId_key" ON "WorshipServiceSettings"("churchId");
CREATE UNIQUE INDEX "WorshipServiceSettings_primaryHymnalId_key" ON "WorshipServiceSettings"("primaryHymnalId");
CREATE UNIQUE INDEX "WorshipHymn_hymnalId_number_key" ON "WorshipHymn"("hymnalId", "number");
CREATE INDEX "WorshipHymn_hymnalId_title_idx" ON "WorshipHymn"("hymnalId", "title");
CREATE INDEX "WorshipHymn_hymnalId_tuneName_idx" ON "WorshipHymn"("hymnalId", "tuneName");
CREATE INDEX "WorshipServiceHymn_hymnId_idx" ON "WorshipServiceHymn"("hymnId");

ALTER TABLE "WorshipHymnal" ADD CONSTRAINT "WorshipHymnal_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorshipServiceSettings" ADD CONSTRAINT "WorshipServiceSettings_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorshipServiceSettings" ADD CONSTRAINT "WorshipServiceSettings_primaryHymnalId_fkey" FOREIGN KEY ("primaryHymnalId") REFERENCES "WorshipHymnal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorshipHymn" ADD CONSTRAINT "WorshipHymn_hymnalId_fkey" FOREIGN KEY ("hymnalId") REFERENCES "WorshipHymnal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorshipServiceHymn" ADD CONSTRAINT "WorshipServiceHymn_hymnId_fkey" FOREIGN KEY ("hymnId") REFERENCES "WorshipHymn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
