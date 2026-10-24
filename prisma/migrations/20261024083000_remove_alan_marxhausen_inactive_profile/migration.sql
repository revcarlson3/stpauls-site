DELETE FROM "ClergyProfile"
WHERE "status" = 'INACTIVE'
  AND lower(trim(coalesce("firstName", ''))) = 'alan'
  AND lower(trim(coalesce("lastName", ''))) = 'marxhausen';
