ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'CREATE_SUPPORT_TICKETS';

CREATE TABLE IF NOT EXISTS "SupportTicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicketAttachment_storedName_key"
  ON "SupportTicketAttachment"("storedName");
CREATE INDEX IF NOT EXISTS "SupportTicketAttachment_ticketId_createdAt_idx"
  ON "SupportTicketAttachment"("ticketId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicketAttachment_ticketId_fkey'
  ) THEN
    ALTER TABLE "SupportTicketAttachment"
      ADD CONSTRAINT "SupportTicketAttachment_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicketAttachment_messageId_fkey'
  ) THEN
    ALTER TABLE "SupportTicketAttachment"
      ADD CONSTRAINT "SupportTicketAttachment_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "SupportTicketMessage"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
