CREATE TYPE "ClergyProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "ClergyProfile" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "membershipIndividualId" TEXT,
    "title" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "biography" TEXT,
    "status" "ClergyProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "photographUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClergyProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClergyProfile_membershipIndividualId_key" ON "ClergyProfile"("membershipIndividualId");
CREATE INDEX "ClergyProfile_churchId_status_lastName_firstName_idx" ON "ClergyProfile"("churchId", "status", "lastName", "firstName");
CREATE INDEX "ClergyProfile_churchId_email_idx" ON "ClergyProfile"("churchId", "email");

ALTER TABLE "ClergyProfile" ADD CONSTRAINT "ClergyProfile_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClergyProfile" ADD CONSTRAINT "ClergyProfile_membershipIndividualId_fkey" FOREIGN KEY ("membershipIndividualId") REFERENCES "MembershipIndividual"("id") ON DELETE SET NULL ON UPDATE CASCADE;
