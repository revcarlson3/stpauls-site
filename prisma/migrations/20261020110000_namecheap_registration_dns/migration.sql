ALTER TABLE "NamecheapConfiguration"
  ADD COLUMN "registrationDnsRecords" JSONB,
  ADD COLUMN "autoVerificationRecord" BOOLEAN NOT NULL DEFAULT true;
