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
export type PublicHymnContent = {
  lyricsText: string;
  lyricsRights: "PUBLIC_DOMAIN";
  musicRights: "PUBLIC_DOMAIN" | "UNKNOWN";
  arrangementRights: "PUBLIC_DOMAIN" | "UNKNOWN";
  musicImageUrl: string | null;
  rightsSourceUrl: string;
  rightsNotes: string;
};

const baseUrl = "https://hymnary.org";
const fallbackHymnals: HymnaryHymnal[] = [
  { code: "LSB2006", name: "Lutheran Service Book (2006)", sourceUrl: `${baseUrl}/hymnal/LSB2006` },
  { code: "TLH1941", name: "The Lutheran Hymnal (1941)", sourceUrl: `${baseUrl}/hymnal/TLH1941` },
  { code: "LW1982", name: "Lutheran Worship (1982)", sourceUrl: `${baseUrl}/hymnal/LW1982` },
  { code: "ELW2006", name: "Evangelical Lutheran Worship (2006)", sourceUrl: `${baseUrl}/hymnal/ELW2006` },
  { code: "LBW1978", name: "Lutheran Book of Worship (1978)", sourceUrl: `${baseUrl}/hymnal/LBW1978` },
  { code: "BH2008", name: "Baptist Hymnal (2008)", sourceUrl: `${baseUrl}/hymnal/BH2008` },
  { code: "BH1991", name: "Baptist Hymnal (1991)", sourceUrl: `${baseUrl}/hymnal/BH1991` },
  { code: "UMH1989", name: "The United Methodist Hymnal (1989)", sourceUrl: `${baseUrl}/hymnal/UMH1989` },
  { code: "EH1982", name: "The Hymnal 1982 (Episcopal)", sourceUrl: `${baseUrl}/hymnal/EH1982` },
  { code: "PH1990", name: "Presbyterian Hymnal (1990)", sourceUrl: `${baseUrl}/hymnal/PH1990` },
  { code: "GATHC2", name: "Gather Comprehensive, Second Edition (Catholic)", sourceUrl: `${baseUrl}/hymnal/GATHC2` },
  { code: "CBOW1994", name: "Catholic Book of Worship III", sourceUrl: `${baseUrl}/hymnal/CBOW1994` },
  { code: "CH1995", name: "Chalice Hymnal (Disciples of Christ)", sourceUrl: `${baseUrl}/hymnal/CH1995` },
  { code: "NC1995", name: "New Century Hymnal (United Church of Christ)", sourceUrl: `${baseUrl}/hymnal/NC1995` },
  { code: "HWB1992", name: "Hymnal: A Worship Book (Mennonite)", sourceUrl: `${baseUrl}/hymnal/HWB1992` },
];

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&#039;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function htmlText(value: string) {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#039;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/[ \t]+\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function publicDomainScan(html: string) {
  const scans = Array.from(html.matchAll(/data-img-src=["']\/page\/fetch\/([A-Za-z0-9_-]+)\/(\d+)\/thumbnail["']/gi));
  for (const scan of scans) {
    const yearMatch = scan[1].match(/(?:19|20)\d{2}$/);
    if (yearMatch && Number(yearMatch[0]) <= 1930) {
      return { imageUrl: `${baseUrl}/page/fetch/${scan[1]}/${scan[2]}/low`, sourceUrl: `${baseUrl}/hymn/${scan[1]}/page/${scan[2]}` };
    }
  }
  return null;
}

export async function fetchPublicHymnContent(sourceUrl: string): Promise<PublicHymnContent | null> {
  const hymnHtml = await fetchText(sourceUrl);
  const textPath = hymnHtml.match(/href=["'](\/text\/[^"']+)["']/i)?.[1];
  if (!textPath) return null;
  const textUrl = `${baseUrl}${textPath}`;
  const textHtml = await fetchText(textUrl);
  if (!/<span[^>]+class=["']hy_infoItem["'][^>]*>\s*Public Domain\s*<\/span>/i.test(textHtml)) return null;
  const lyricsMatch = textHtml.match(/<div[^>]+property=["']text["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]+class=["']authority_bottom_bar/i);
  const lyricsText = lyricsMatch ? htmlText(lyricsMatch[1]) : "";
  if (!lyricsText) return null;
  const scan = publicDomainScan(textHtml);
  return {
    lyricsText,
    lyricsRights: "PUBLIC_DOMAIN",
    musicRights: scan ? "PUBLIC_DOMAIN" : "UNKNOWN",
    arrangementRights: scan ? "PUBLIC_DOMAIN" : "UNKNOWN",
    musicImageUrl: scan?.imageUrl ?? null,
    rightsSourceUrl: textUrl,
    rightsNotes: scan ? `Hymnary marks the text public domain; score image linked from the pre-1931 ${scan.sourceUrl.split("/hymn/")[1].split("/")[0]} source scan.` : "Hymnary marks the text public domain. No qualifying pre-1931 score scan was available.",
  };
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

function parseCsvLine(line: string) {
    const values: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === "," && !quoted) {
        values.push(value.trim());
        value = "";
      } else {
        value += character;
      }
    }
    values.push(value.trim());
    return values;
}

export function parseHymnalCsv(csv: string, code: string) {
    const rows = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
    if (rows.length < 2 || /<html/i.test(rows[0])) return [];
    const headerIndex = rows.findIndex((line) => parseCsvLine(line).some((header) => ["title", "hymntitle", "displaytitle", "texttitle", "hymn"].includes(header.toLowerCase().replace(/[^a-z0-9]/g, ""))));
    if (headerIndex < 0) return [];
    const headers = parseCsvLine(rows[headerIndex]).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const column = (...names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
    const numberColumn = column("number", "hymnnumber", "hymnalnumber", "no");
    const titleColumn = column("title", "hymntitle", "displaytitle", "texttitle", "hymn", "name");
    const firstLineColumn = column("firstline", "firstlineofthehymn");
    const tuneColumn = column("tune", "tunename", "tunetitle");
    const tuneAuthorsColumn = column("tuneauthors", "tuneauthor", "composers");
    const textAuthorsColumn = column("authors", "textauthors", "author");
    const copyrightColumn = column("copyright", "copyrightinfo");
    const urlColumn = column("url", "sourceurl", "hymnurl", "hymnarylink");
    if (titleColumn < 0) return [];
    return rows.slice(headerIndex + 1).map((line) => {
      const values = parseCsvLine(line);
      const number = numberColumn >= 0 ? decode(values[numberColumn] ?? "") || null : null;
      const title = decode(values[titleColumn] ?? "");
      const sourcePath = urlColumn >= 0 ? values[urlColumn] : "";
      const sourceUrl = sourcePath?.startsWith("http") ? sourcePath : `${baseUrl}/hymn/${code}/${encodeURIComponent(number ?? title)}`;
      return { number, title, firstLine: firstLineColumn >= 0 ? decode(values[firstLineColumn] ?? "") || null : null, tuneName: tuneColumn >= 0 ? decode(values[tuneColumn] ?? "") || null : null, tuneAuthors: tuneAuthorsColumn >= 0 ? decode(values[tuneAuthorsColumn] ?? "") || null : null, textAuthors: textAuthorsColumn >= 0 ? decode(values[textAuthorsColumn] ?? "") || null : null, copyrightInfo: copyrightColumn >= 0 ? decode(values[copyrightColumn] ?? "") || null : null, sourceUrl };
    }).filter((hymn) => hymn.title).filter((hymn, index, all) => all.findIndex((candidate) => candidate.number === hymn.number && candidate.title === hymn.title) === index);
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

async function fetchText(url: string, accept = "text/html") {
  const response = await fetch(url, { headers: { "User-Agent": "StPaulsSite/1.0 (hymnal metadata importer)", Accept: accept }, signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!response.ok) throw new Error(`Hymnary returned HTTP ${response.status}.`);
  return response.text();
}

async function importCsvPages(url: string, code: string) {
  const hymns: HymnaryHymn[] = [];
  let duplicatePages = 0;
  for (let page = 0; page < 20; page += 1) {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set("page", String(page));
    const parsed = parseHymnalCsv(await fetchText(pageUrl.toString(), "text/csv"), code);
    const before = new Set(hymns.map((hymn) => `${hymn.number}|${hymn.title}`)).size;
    hymns.push(...parsed);
    const uniqueCount = new Set(hymns.map((hymn) => `${hymn.number}|${hymn.title}`)).size;
    if (!parsed.length || uniqueCount === before) duplicatePages += 1;
    else duplicatePages = 0;
    if (duplicatePages >= 2) break;
  }
  return hymns.filter((hymn, index, all) => all.findIndex((candidate) => candidate.number === hymn.number && candidate.title === hymn.title) === index);
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
  const csvUrls = [
    `${baseUrl}/instances?qu=hymnalNumber%3A${encodeURIComponent(code.toLowerCase())}%20in%3Ainstances&sort=firstLine&order=asc&export=csv&limit=10000`,
    `${sourceUrl}?export=csv`,
    `${sourceUrl}/titles?export=csv`,
  ];
  for (let index = 0; index < csvUrls.length; index += 1) {
    const csvUrl = csvUrls[index];
    try {
      const csvHymns = index === 0
        ? parseHymnalCsv(await fetchText(csvUrl, "text/csv"), code)
        : await importCsvPages(csvUrl, code);
      if (csvHymns.length > 100) return { code, name: name?.trim().slice(0, 200) || code, sourceUrl, hymns: csvHymns };
    } catch {
      // Try the next documented Hymnary CSV endpoint.
    }
  }
  throw new Error("Hymnary did not return a complete CSV catalog for that hymnal. No partial 100-hymn import was saved.");
}
