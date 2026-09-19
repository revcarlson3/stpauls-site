ALTER TABLE "Church"
  ADD COLUMN "lifecycleStatus" "TenantLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  ADD COLUMN "onboardingStep" TEXT;

CREATE INDEX "Church_lifecycleStatus_idx" ON "Church"("lifecycleStatus");
