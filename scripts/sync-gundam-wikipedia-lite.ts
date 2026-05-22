import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import type { LiteMediaEntry } from "../app/lite-types";

type WikipediaSummary = {
  pageid?: number;
  title?: string;
  extract?: string;
  thumbnail?: {
    source?: string;
  };
};

const wikipediaOrigin = "https://en.wikipedia.org";
const gundamPageTitle = "Gundam";
const outputPath = path.join(process.cwd(), "data", "g-list-lite-media.json");
const userAgent =
  "G-LIST-Lite/0.1 (personal media tracker; https://github.com/)";

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanText(value: string): string {
  return value.replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
}

function absoluteWikipediaUrl(href: string): string {
  if (href.startsWith("http")) {
    return href;
  }

  return `${wikipediaOrigin}${href}`;
}

function pageTitleFromHref(href: string): string | undefined {
  if (!href.startsWith("/wiki/")) {
    return undefined;
  }

  const rawTitle = href.replace("/wiki/", "").split("#")[0];
  return decodeURIComponent(rawTitle).replace(/_/g, " ");
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchJson<T>(url: string, attempt = 1): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Api-User-Agent": userAgent,
      "User-Agent": userAgent
    }
  });

  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : 1200 * attempt;

    await sleep(delay);
    return fetchJson<T>(url, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  return (await response.json()) as T;
}

async function fetchGundamPageHtml(): Promise<string> {
  type ParseResponse = {
    parse: {
      text: string;
    };
  };

  const params = new URLSearchParams({
    action: "parse",
    format: "json",
    page: gundamPageTitle,
    prop: "text",
    disableeditsection: "1",
    formatversion: "2"
  });

  const data = await fetchJson<ParseResponse>(
    `${wikipediaOrigin}/w/api.php?${params.toString()}`
  );

  return data.parse.text;
}

function findMediaTable($: CheerioAPI): cheerio.Cheerio<Element> {
  const heading = $("#TV_series,_films,_and_video").first();
  const container = heading.closest("h2, h3");
  const table = container.nextAll("table").filter(".wikitable").first();

  if (table.length > 0) {
    return table;
  }

  const fallback = $("table.wikitable").filter((_, element) => {
    const headers = $(element)
      .find("tr")
      .first()
      .find("th")
      .map((__, header) => cleanText($(header).text()).toLowerCase())
      .get();

    return (
      headers.some((header) => header.includes("name")) &&
      headers.some((header) => header.includes("media")) &&
      headers.some((header) => header.includes("release"))
    );
  });

  return fallback.first();
}

function entryFromRow(
  $: CheerioAPI,
  row: Element,
  usedIds: Map<string, number>,
  tableState: {
    name?: string;
    href?: string;
    nameRowsRemaining: number;
    releaseDate?: string;
    releaseRowsRemaining: number;
    timelineAndYear?: string;
    timelineRowsRemaining: number;
  }
): LiteMediaEntry | undefined {
  const dataCells = $(row).children("td");

  if (dataCells.length === 0) {
    return undefined;
  }

  let cellIndex = 0;
  if (tableState.nameRowsRemaining > 0) {
    tableState.nameRowsRemaining -= 1;
  } else {
    const nameCell = dataCells.eq(cellIndex);
    const nameLink = nameCell.find('a[href^="/wiki/"]').first();
    const href = nameLink.attr("href");

    tableState.name = cleanText(nameCell.text());
    tableState.href = href;
    tableState.nameRowsRemaining = Number(nameCell.attr("rowspan") ?? 1) - 1;
    cellIndex += 1;
  }

  if (cellIndex >= dataCells.length) {
    return undefined;
  }

  const media = cleanText(dataCells.eq(cellIndex).text());
  cellIndex += 1;

  if (tableState.releaseRowsRemaining > 0) {
    tableState.releaseRowsRemaining -= 1;
  } else if (cellIndex < dataCells.length) {
    const releaseCell = dataCells.eq(cellIndex);
    tableState.releaseDate = cleanText(releaseCell.text());
    tableState.releaseRowsRemaining =
      Number(releaseCell.attr("rowspan") ?? 1) - 1;
    cellIndex += 1;
  } else {
    tableState.releaseDate = undefined;
  }

  if (tableState.timelineRowsRemaining > 0) {
    tableState.timelineRowsRemaining -= 1;
  } else if (cellIndex < dataCells.length) {
    const timelineCell = dataCells.eq(cellIndex);
    tableState.timelineAndYear = cleanText(timelineCell.text());
    tableState.timelineRowsRemaining =
      Number(timelineCell.attr("rowspan") ?? 1) - 1;
  } else {
    tableState.timelineAndYear = undefined;
  }

  if (!tableState.name || !media || !tableState.releaseDate) {
    return undefined;
  }

  const name = tableState.name;
  const href = tableState.href;
  const sourceUrl = href ? absoluteWikipediaUrl(href) : `${wikipediaOrigin}/wiki/Gundam`;
  const pageTitle = href ? pageTitleFromHref(href) : undefined;

  const baseId = slugify(
    `${pageTitle ?? name}-${media}-${tableState.releaseDate}`
  );
  const currentCount = usedIds.get(baseId) ?? 0;
  usedIds.set(baseId, currentCount + 1);

  return {
    id: currentCount === 0 ? baseId : `${baseId}-${currentCount + 1}`,
    name,
    media,
    releaseDate: tableState.releaseDate,
    timelineAndYear: tableState.timelineAndYear ?? "",
    sourceUrl,
    pageTitle
  };
}

function parseMediaEntries(html: string): LiteMediaEntry[] {
  const $ = cheerio.load(html);
  const table = findMediaTable($);

  if (table.length === 0) {
    throw new Error("Could not find the Gundam media table on Wikipedia.");
  }

  const usedIds = new Map<string, number>();
  const tableState: {
    name?: string;
    href?: string;
    nameRowsRemaining: number;
    releaseDate?: string;
    releaseRowsRemaining: number;
    timelineAndYear?: string;
    timelineRowsRemaining: number;
  } = {
    nameRowsRemaining: 0,
    releaseRowsRemaining: 0,
    timelineRowsRemaining: 0
  };

  return table
    .find("tr")
    .map((_, row) => entryFromRow($, row, usedIds, tableState))
    .get()
    .filter(Boolean);
}

async function enrichEntry(entry: LiteMediaEntry): Promise<LiteMediaEntry> {
  if (!entry.pageTitle) {
    return entry;
  }

  try {
    const summary = await fetchJson<WikipediaSummary>(
      `${wikipediaOrigin}/api/rest_v1/page/summary/${encodeURIComponent(
        entry.pageTitle
      )}`
    );

    return {
      ...entry,
      pageTitle: summary.title ?? entry.pageTitle,
      pageId: summary.pageid,
      extract: summary.extract,
      thumbnailUrl: summary.thumbnail?.source
    };
  } catch (error) {
    console.warn(`Could not fetch summary for ${entry.name}:`, error);
    return entry;
  }
}

async function main(): Promise<void> {
  const html = await fetchGundamPageHtml();
  const parsedEntries = parseMediaEntries(html);
  const enrichedEntries: LiteMediaEntry[] = [];

  for (const entry of parsedEntries) {
    enrichedEntries.push(await enrichEntry(entry));
    await sleep(150);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(enrichedEntries, null, 2)}\n`,
    "utf8"
  );

  console.log(`Saved ${enrichedEntries.length} entries to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
