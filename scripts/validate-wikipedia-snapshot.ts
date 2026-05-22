import { readFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { LiteMediaEntry } from "../app/lite-types";

type TableCell = {
  value: string;
  remainingRows: number;
};

type WikipediaRow = {
  name: string;
  media: string;
  releaseDate: string;
  timelineAndYear: string;
};

const wikipediaOrigin = "https://en.wikipedia.org";
const snapshotPath = path.join(process.cwd(), "data", "g-list-lite-media.json");
const userAgent =
  "G-LIST-Lite/0.1 (personal media tracker validation; https://github.com/)";

function cleanText(value: string): string {
  return value
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string): string {
  return cleanText(value)
    .normalize("NFKC")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
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
    page: "Gundam",
    prop: "text",
    disableeditsection: "1",
    formatversion: "2"
  });

  const response = await fetch(`${wikipediaOrigin}/w/api.php?${params}`, {
    headers: {
      "Api-User-Agent": userAgent,
      "User-Agent": userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`Wikipedia fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as ParseResponse;
  return data.parse.text;
}

function findMediaTable($: cheerio.CheerioAPI): cheerio.Cheerio<Element> {
  return $("table.wikitable")
    .filter((_, element) => {
      const headers = $(element)
        .find("tr")
        .first()
        .find("th")
        .map((__, header) => cleanText($(header).text()).toLowerCase())
        .get();

      return (
        headers.includes("name") &&
        headers.includes("media") &&
        headers.includes("release date") &&
        headers.includes("timeline and year")
      );
    })
    .first();
}

function parseWikipediaRows(html: string): WikipediaRow[] {
  const $ = cheerio.load(html);
  const table = findMediaTable($);
  const carriedCells: Array<TableCell | undefined> = [];
  const rows: WikipediaRow[] = [];

  if (table.length === 0) {
    throw new Error("Could not find the Wikipedia media table.");
  }

  table.find("tr").each((rowIndex, row) => {
    if (rowIndex === 0) {
      return;
    }

    const cells = $(row).children("td").toArray();
    let sourceCellIndex = 0;
    const rowValues: string[] = [];

    for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
      const carriedCell = carriedCells[columnIndex];

      if (carriedCell && carriedCell.remainingRows > 0) {
        rowValues[columnIndex] = carriedCell.value;
        carriedCell.remainingRows -= 1;
        continue;
      }

      const sourceCell = cells[sourceCellIndex];

      if (!sourceCell) {
        rowValues[columnIndex] = "";
        continue;
      }

      const cell = $(sourceCell);
      const value = cleanText(cell.text());
      const rowspan = Number(cell.attr("rowspan") ?? 1);

      rowValues[columnIndex] = value;
      carriedCells[columnIndex] =
        rowspan > 1 ? { value, remainingRows: rowspan - 1 } : undefined;
      sourceCellIndex += 1;
    }

    if (rowValues.some((value) => value.length > 0)) {
      rows.push({
        name: rowValues[0],
        media: rowValues[1],
        releaseDate: rowValues[2],
        timelineAndYear: rowValues[3]
      });
    }
  });

  return rows;
}

function compareRows(wikipediaRows: WikipediaRow[], snapshotRows: LiteMediaEntry[]) {
  const maxRows = Math.max(wikipediaRows.length, snapshotRows.length);
  const mismatches: string[] = [];

  for (let index = 0; index < maxRows; index += 1) {
    const wikipediaRow = wikipediaRows[index];
    const snapshotRow = snapshotRows[index];

    if (!wikipediaRow || !snapshotRow) {
      mismatches.push(
        `Row ${index + 1}: ${
          wikipediaRow ? "missing snapshot row" : "extra snapshot row"
        }`
      );
      continue;
    }

    const fields: Array<keyof WikipediaRow> = [
      "name",
      "media",
      "releaseDate",
      "timelineAndYear"
    ];

    for (const field of fields) {
      if (normalize(wikipediaRow[field]) !== normalize(snapshotRow[field])) {
        mismatches.push(
          `Row ${index + 1} ${field}: wiki="${wikipediaRow[field]}" snapshot="${snapshotRow[field]}"`
        );
      }
    }
  }

  return mismatches;
}

async function main() {
  const [html, snapshot] = await Promise.all([
    fetchGundamPageHtml(),
    readFile(snapshotPath, "utf8")
  ]);
  const wikipediaRows = parseWikipediaRows(html);
  const snapshotRows = JSON.parse(snapshot) as LiteMediaEntry[];
  const mismatches = compareRows(wikipediaRows, snapshotRows);

  console.log(`Wikipedia rows: ${wikipediaRows.length}`);
  console.log(`Snapshot rows: ${snapshotRows.length}`);

  if (mismatches.length > 0) {
    console.error(`Found ${mismatches.length} mismatch(es):`);
    for (const mismatch of mismatches.slice(0, 30)) {
      console.error(mismatch);
    }

    if (mismatches.length > 30) {
      console.error(`...and ${mismatches.length - 30} more`);
    }

    process.exitCode = 1;
    return;
  }

  console.log("Snapshot matches the live Wikipedia media table.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

