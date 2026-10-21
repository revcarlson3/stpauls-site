UPDATE "PrayerRequest"
SET "adminFormatted" = true
WHERE "adminFormatted" = false
  AND "request" ~ '<[[:alpha:]][^>]*>';
