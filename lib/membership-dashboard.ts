import { Prisma } from "@prisma/client";

export * from "./membership-dashboard-shared";

export const activeMembershipIndividualWhere = {
  status: "ACTIVE" as const,
  deceasedDate: null,
  family: { status: "ACTIVE" as const }
};

export const activeMembershipIndividualSql = Prisma.sql`
  i.status = 'ACTIVE'
  AND i."deceasedDate" IS NULL
  AND f.status = 'ACTIVE'
`;
