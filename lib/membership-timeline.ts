export type MembershipTimelineItem = {
  id: string;
  type: "audit" | "document" | "note" | "record" | "volunteer";
  title: string;
  description?: string | null;
  occurredAt: string;
  actor?: string | null;
  individualId?: string;
  individualName?: string;
  document?: {
    id: string;
    name: string;
    downloadUrl: string;
  };
};

export function sortTimelineItems(items: MembershipTimelineItem[], limit = 300) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
    .sort((left, right) => {
      const dateDifference = new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
      return dateDifference || left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}

export function recordTimelineItems(input: {
  id: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
  individualId?: string;
  individualName?: string;
}) {
  const shared = {
    type: "record" as const,
    individualId: input.individualId,
    individualName: input.individualName
  };
  const items: MembershipTimelineItem[] = [{
    ...shared,
    id: `record-created-${input.id}`,
    title: `${input.label} created`,
    occurredAt: input.createdAt.toISOString()
  }];

  if (input.updatedAt.getTime() > input.createdAt.getTime() + 1000) {
    items.push({
      ...shared,
      id: `record-updated-${input.id}`,
      title: `${input.label} last updated`,
      occurredAt: input.updatedAt.toISOString()
    });
  }
  return items;
}

export function membershipAuditDetails(input: {
  familyId?: string;
  individualId?: string;
  noteId?: string;
  documentId?: string;
  reason?: string;
}) {
  return JSON.stringify(input);
}
