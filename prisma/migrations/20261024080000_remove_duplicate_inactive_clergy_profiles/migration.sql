DELETE FROM "ClergyProfile" AS duplicate
WHERE duplicate."status" = 'INACTIVE'
  AND EXISTS (
    SELECT 1
    FROM "ClergyProfile" AS canonical
    WHERE canonical."id" <> duplicate."id"
      AND canonical."churchId" = duplicate."churchId"
      AND lower(trim(coalesce(canonical."firstName", ''))) = lower(trim(coalesce(duplicate."firstName", '')))
      AND lower(trim(coalesce(canonical."lastName", ''))) = lower(trim(coalesce(duplicate."lastName", '')))
      AND lower(trim(coalesce(canonical."email", ''))) = lower(trim(coalesce(duplicate."email", '')))
      AND (
        canonical."status" = 'ACTIVE'
        OR canonical."createdAt" < duplicate."createdAt"
      )
  );
