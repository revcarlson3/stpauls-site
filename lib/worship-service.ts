export const LSB_LITURGIES = [
  "Divine Service, Setting One",
  "Divine Service, Setting Two",
  "Divine Service, Setting Three",
  "Divine Service, Setting Four",
  "Divine Service, Setting Five",
  "Matins",
  "Vespers",
  "Morning Prayer",
  "Evening Prayer",
  "Compline",
  "Service of Prayer and Preaching",
  "Holy Baptism",
  "Confirmation",
  "Holy Matrimony",
  "Funeral Service",
  "Responsive Prayer I",
  "Responsive Prayer II",
  "The Litany",
  "Corporate Confession and Absolution",
  "Individual Confession and Absolution",
  "Daily Prayer for Individuals and Families",
] as const;

export const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
  "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah",
  "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians",
  "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians",
  "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
] as const;

export type WorshipServiceHymnInput = { hymnId?: string; custom?: boolean; number?: string; title?: string; sourceUrl?: string };
export type WorshipServiceLessonInput = {
  book: string;
  startChapter: number;
  startVerse?: number;
  endChapter?: number;
  endVerse?: number;
  reference?: string;
};

export type WorshipServicePericopes = {
  lectionary: "ONE_YEAR" | "THREE_YEAR";
  key: string;
  name: string;
  date?: string;
  series?: string | null;
  readings: { oldTestament?: string | null; psalm?: string | null; epistle?: string | null; gospel?: string | null };
  introit?: { name?: string | null; reference?: string | null; text?: string | null } | null;
  gradual?: string | null;
  verse?: string | null;
  collect?: string | null;
  source?: string | null;
};

export function safeVideoUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = value.trim();
  return /^https?:\/\/\S+$/i.test(url) ? url.slice(0, 500) : undefined;
}

export function formatLessonReference(lesson: WorshipServiceLessonInput) {
  const start = `${lesson.book} ${lesson.startChapter}${lesson.startVerse ? `:${lesson.startVerse}` : ""}`;
  if (!lesson.endChapter && !lesson.endVerse) return start;
  return `${start}-${lesson.endChapter ?? lesson.startChapter}${lesson.endVerse ? `:${lesson.endVerse}` : ""}`;
}
