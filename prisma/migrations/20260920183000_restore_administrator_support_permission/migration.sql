INSERT INTO "GroupPermission" ("groupId", "permission")
SELECT "id", 'CREATE_SUPPORT_TICKETS'::"Permission"
FROM "SecurityGroup"
WHERE "slug" = 'administrator'
ON CONFLICT ("groupId", "permission") DO NOTHING;
