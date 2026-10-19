CREATE TABLE "OnePanelConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "baseUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "version" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnePanelConfiguration_pkey" PRIMARY KEY ("id")
);
