export const CLERGY_TITLES = [
  "Rev.",
  "The Rev.",
  "Rev. Dr.",
  "The Rev. Dr.",
  "Fr.",
  "Dr.",
  "Deacon",
  "Bishop",
  "Canon",
  "Pastor",
  "Priest",
  "Minister",
  "Chaplain",
  "Other",
] as const;

export type ClergyTitle = typeof CLERGY_TITLES[number];
