CREATE TYPE "WorshipServiceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

CREATE TABLE "WorshipService" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "liturgy" TEXT,
  "status" "WorshipServiceStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "livestreamEnabled" BOOLEAN NOT NULL DEFAULT false,
  "videoUrl" TEXT,
  "bulletinUrl" TEXT,
  "featuredImageUrl" TEXT,
  "eventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorshipService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorshipServiceClergy" (
  "serviceId" TEXT NOT NULL,
  "clergyId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WorshipServiceClergy_pkey" PRIMARY KEY ("serviceId", "clergyId")
);

CREATE TABLE "WorshipServiceHymn" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "number" TEXT,
  "title" TEXT NOT NULL,
  "sourceUrl" TEXT,
  CONSTRAINT "WorshipServiceHymn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorshipServiceLesson" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "book" TEXT NOT NULL,
  "startChapter" INTEGER NOT NULL,
  "startVerse" INTEGER,
  "endChapter" INTEGER,
  "endVerse" INTEGER,
  "reference" TEXT,
  CONSTRAINT "WorshipServiceLesson_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorshipService_eventId_key" ON "WorshipService"("eventId");
CREATE INDEX "WorshipService_churchId_startsAt_idx" ON "WorshipService"("churchId", "startsAt");
CREATE INDEX "WorshipService_churchId_status_scheduledAt_idx" ON "WorshipService"("churchId", "status", "scheduledAt");
CREATE INDEX "WorshipServiceClergy_clergyId_idx" ON "WorshipServiceClergy"("clergyId");
CREATE INDEX "WorshipServiceHymn_serviceId_sortOrder_idx" ON "WorshipServiceHymn"("serviceId", "sortOrder");
CREATE INDEX "WorshipServiceLesson_serviceId_sortOrder_idx" ON "WorshipServiceLesson"("serviceId", "sortOrder");

ALTER TABLE "WorshipService" ADD CONSTRAINT "WorshipService_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorshipService" ADD CONSTRAINT "WorshipService_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MembershipEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorshipServiceClergy" ADD CONSTRAINT "WorshipServiceClergy_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorshipServiceClergy" ADD CONSTRAINT "WorshipServiceClergy_clergyId_fkey" FOREIGN KEY ("clergyId") REFERENCES "ClergyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorshipServiceHymn" ADD CONSTRAINT "WorshipServiceHymn_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorshipServiceLesson" ADD CONSTRAINT "WorshipServiceLesson_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "WorshipService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
