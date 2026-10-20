type VolunteerAssignment = {
  groupId: string;
  group: { name: string };
  individual: { id: string };
};

export function getOtherVolunteerGroupNames(assignments: VolunteerAssignment[], assignment: VolunteerAssignment) {
  return Array.from(new Set(
    assignments
      .filter((candidate) => candidate.individual.id === assignment.individual.id && candidate.groupId !== assignment.groupId)
      .map((candidate) => candidate.group.name)
  )).sort((first, second) => first.localeCompare(second));
}
