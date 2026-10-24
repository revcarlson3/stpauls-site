ALTER TABLE "WorshipServiceSettings"
ADD COLUMN IF NOT EXISTS "streamingDestinations" JSONB;
