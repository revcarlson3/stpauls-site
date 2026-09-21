ALTER TABLE "User"
  ADD COLUMN "lastAccessAt" TIMESTAMP(3),
  ADD COLUMN "lastSessionRevokedAt" TIMESTAMP(3);
