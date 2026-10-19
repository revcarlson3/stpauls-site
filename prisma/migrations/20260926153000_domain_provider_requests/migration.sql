CREATE TABLE "DomainProviderRequest" (
    "id" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "idempotencyKey" TEXT NOT NULL,
    "confirmationHash" TEXT NOT NULL,
    "externalId" TEXT,
    "externalStatus" TEXT,
    "lastError" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DomainProviderRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DomainProviderRequest_confirmationHash_key" ON "DomainProviderRequest"("confirmationHash");
CREATE UNIQUE INDEX "DomainProviderRequest_churchId_operation_idempotencyKey_key" ON "DomainProviderRequest"("churchId", "operation", "idempotencyKey");
CREATE INDEX "DomainProviderRequest_churchId_status_idx" ON "DomainProviderRequest"("churchId", "status");
CREATE INDEX "DomainProviderRequest_externalId_idx" ON "DomainProviderRequest"("externalId");
