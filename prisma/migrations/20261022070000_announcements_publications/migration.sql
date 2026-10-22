CREATE TABLE "AnnouncementPublication" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnnouncementPublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnnouncementTemplate" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnnouncementTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnnouncementEmailDelivery" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENDING',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "note" TEXT,
    CONSTRAINT "AnnouncementEmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnouncementTemplate_churchId_name_key" ON "AnnouncementTemplate"("churchId", "name");
CREATE UNIQUE INDEX "AnnouncementEmailDelivery_publicationId_key" ON "AnnouncementEmailDelivery"("publicationId");
CREATE INDEX "AnnouncementPublication_churchId_status_publishAt_idx" ON "AnnouncementPublication"("churchId", "status", "publishAt");
CREATE INDEX "AnnouncementPublication_churchId_publishedAt_idx" ON "AnnouncementPublication"("churchId", "publishedAt");
CREATE INDEX "AnnouncementTemplate_churchId_updatedAt_idx" ON "AnnouncementTemplate"("churchId", "updatedAt");

ALTER TABLE "AnnouncementPublication" ADD CONSTRAINT "AnnouncementPublication_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementPublication" ADD CONSTRAINT "AnnouncementPublication_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnnouncementPublication" ADD CONSTRAINT "AnnouncementPublication_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AnnouncementPublication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnnouncementTemplate" ADD CONSTRAINT "AnnouncementTemplate_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementTemplate" ADD CONSTRAINT "AnnouncementTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnnouncementEmailDelivery" ADD CONSTRAINT "AnnouncementEmailDelivery_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "AnnouncementPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
