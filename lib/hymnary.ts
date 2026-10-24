export type HymnaryHymnal = { code: string; name: string; sourceUrl: string };
export type HymnaryHymn = {
  number: string | null;
  title: string;
  firstLine: string | null;
  tuneName: string | null;
  tuneAuthors: string | null;
  textAuthors: string | null;
  copyrightInfo: string | null;
  sourceUrl: string;
};

const baseUrl = "https://hymnary.org";
const fallbackHymnals: HymnaryHymnal[] = [
  { code: "LSB2006", name: "Lutheran Service Book (2006)", sourceUrl: `${baseUrl}/hymnal/LSB2006` },
  { code: "TLH1941", name: "The Lutheran Hymnal (1941)", sourceUrl: `${baseUrl}/hymnal/TLH1941` },
  { code: "LW1982", name: "Lutheran Worship (1982)", sourceUrl: `${baseUrl}/hymnal/LW1982` },
  { code: "ELW2006", name: "Evangelical Lutheran Worship (2006)", sourceUrl: `${baseUrl}/hymnal/ELW2006` },
  { code: "LBW1978", name: "Lutheran Book of Worship (1978)", sourceUrl: `${baseUrl}/hymnal/LBW1978` },
];

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&#039;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function parseHymnalList(html: string) {
  const result = new Map<string, HymnaryHymnal>();
  for (const match of Array.from(html.matchAll(/<a\b[^>]*href=["']\/hymnal\/([A-Za-z0-9_-]+)["'][^>]*>([\s\S]*?)<\/a>/gi))) {
    const code = match[1];
    const name = decode(match[2]);
    if (name && code) result.set(code, { code, name, sourceUrl: `${baseUrl}/hymnal/${code}` });
  }
  return Array.from(result.values());
}

export function parseHymnalHymns(html: string, code: string) {
  const result: HymnaryHymn[] = [];
  for (const row of Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))) {
    const content = row[1];
    const links = Array.from(content.matchAll(new RegExp(`<a\\b[^>]*href=["']\\/hymn\\/${code}\\/([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>`, "gi")));
    if (!links.length) continue;
    const number = decode(links[0][2]) || decode(links[0][1]);
    const title = decode(links.length > 1 ? links[1][2] : links[0][2]);
    const tuneMatch = content.match(/<a\b[^>]*href=["']\/tune\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!title) continue;
    result.push({ number, title, firstLine: null, tuneName: decode(tuneMatch?.[1] ?? "") || null, tuneAuthors: null, textAuthors: null, copyrightInfo: null, sourceUrl: `${baseUrl}/hymn/${code}/${encodeURIComponent(links[0][1])}` });
  }
  return result.filter((hymn, index, all) => all.findIndex((candidate) => candidate.number === hymn.number && candidate.title === hymn.title) === index);
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "StPaulsSite/1.0 (hymnal metadata importer)", Accept: "text/html" }, signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!response.ok) throw new Error(`Hymnary returned HTTP ${response.status}.`);
  return response.text();
}

export async function listHymnals() {
  try {
    const parsed = parseHymnalList(await fetchText(`${baseUrl}/hymnals`));
    return parsed.length ? parsed : fallbackHymnals;
  } catch {
    return fallbackHymnals;
  }
}

export async function importHymnal(code: string, name?: string) {
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(code)) throw new Error("Invalid hymnal selection.");
  const sourceUrl = `${baseUrl}/hymnal/${code}`;
  const firstPage = await fetchText(sourceUrl);
  const pages = new Set<number>([0]);
  for (const match of Array.from(firstPage.matchAll(/[?&]page=(\d+)/g))) pages.add(Number(match[1]));
  const hymns = [...parseHymnalHymns(firstPage, code)];
  for (const page of Array.from(pages).filter((value) => value > 0).sort((a, b) => a - b).slice(0, 12)) {
    try { hymns.push(...parseHymnalHymns(await fetchText(`${sourceUrl}?page=${page}`), code)); } catch { break; }
  }
  const unique = hymns.filter((hymn, index, all) => all.findIndex((candidate) => candidate.number === hymn.number && candidate.title === hymn.title) === index);
  if (!unique.length) throw new Error("Hymnary did not return hymn metadata for that hymnal.");
  return { code, name: name?.trim().slice(0, 200) || code, sourceUrl, hymns: unique };
}
