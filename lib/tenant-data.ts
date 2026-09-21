/**
 * Selects the church used when importing legacy single-tenant rows. Keeping
 * this rule deterministic makes the SQL migration and application backfills
 * agree: an active church wins, then the oldest church.
 */
export function selectBackfillChurch<T extends { id: string; status: string; createdAt: Date }>(churches: T[]) {
  return churches.find((church) => church.status === "ACTIVE")?.id ?? churches.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]?.id ?? null;
}

export function tenantFilter(churchId: string) {
  return { churchId };
}
