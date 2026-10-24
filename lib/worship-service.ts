export const LSB_LITURGIES = [
  "Divine Service, Setting One",
  "Divine Service, Setting Two",
  "Divine Service, Setting Three",
  "Divine Service, Setting Four",
  "Divine Service, Setting Five",
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

export type WorshipServiceHymnInput = { number?: string; title: string; sourceUrl?: string };
export type WorshipServiceLessonInput = {
  book: string;
  startChapter: number;
  startVerse?: number;
  endChapter?: number;
  endVerse?: number;
  reference?: string;
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
