import type {
  LanguagePreference,
  LiteMediaEntry,
  LiteTrackingEntry,
  SortDirection,
  SortKey,
  WatchStatus
} from "./lite-types";

export const watchStatuses: WatchStatus[] = [
  "Unwatched",
  "Watching",
  "Watched",
  "Up Next"
];

export const languageOptions: LanguagePreference[] = [
  "",
  "Eng",
  "Sub",
  "Jpn"
];

const englishDubTitles = new Set([
  "Mobile Suit Gundam",
  "Mobile Suit Zeta Gundam",
  "Mobile Suit Gundam: Char's Counterattack",
  "Mobile Suit Gundam 0080: War in the Pocket",
  "Mobile Suit Gundam F91",
  "Mobile Suit Gundam 0083: Stardust Memory",
  "Mobile Fighter G Gundam",
  "Mobile Suit Gundam Wing",
  "Mobile Suit Gundam: The 08th MS Team",
  "Gundam Wing: Endless Waltz",
  "G-Saviour",
  "Mobile Suit Gundam SEED",
  "Superior Defender Gundam Force",
  "Mobile Suit Gundam SEED Destiny",
  "Mobile Suit Gundam SEED C.E. 73: Stargazer",
  "Mobile Suit Gundam 00",
  "Mobile Suit Gundam Unicorn",
  "Mobile Suit Gundam 00 the Movie: A Wakening of the Trailblazer",
  "Gundam Build Fighters",
  "Mobile Suit Gundam: The Origin",
  "Mobile Suit Gundam: Iron-Blooded Orphans",
  "Mobile Suit Gundam Thunderbolt",
  "Gundam Build Divers",
  "Mobile Suit Gundam Narrative",
  "Gundam Build Divers Re:Rise",
  "Mobile Suit Gundam Hathaway",
  "Mobile Suit Gundam: Cucuruz Doan's Island",
  "Mobile Suit Gundam: The Witch from Mercury",
  "Mobile Suit Gundam SEED Freedom",
  "Mobile Suit Gundam: Silver Phantom",
  "Gundam: Requiem for Vengeance",
  "Mobile Suit Gundam GQuuuuuuX"
]);

const japaneseOnlyTitles = new Set([
  "Gundam: Mission to the Rise",
  "Gundam Neo Experience 0087: Green Diver",
  "Mobile Suit Gundam Battlefield Record: Avant-Title",
  "Ring of Gundam",
  "Mobile Suit Gundam G40",
  "Gundam Build Real",
  "Mobile Suit Gundam SEED Freedom Zero",
  "Gundam"
]);

export function getWatchStatusLabel(status: WatchStatus): string {
  return status === "Up Next" ? "To Watch" : status;
}

export function getDefaultLanguageForEntry(
  entry: LiteMediaEntry
): LanguagePreference {
  if (englishDubTitles.has(entry.name)) {
    return "Eng";
  }

  if (japaneseOnlyTitles.has(entry.name)) {
    return "Jpn";
  }

  return "Sub";
}

export function getLanguageForEntry(
  entry: LiteMediaEntry,
  tracking: LiteTrackingEntry
): LanguagePreference {
  return tracking.lang ?? getDefaultLanguageForEntry(entry);
}

export function getTrackingForTitle(
  tracking: Record<string, LiteTrackingEntry>,
  titleId: string
): LiteTrackingEntry {
  return tracking[titleId] ?? { titleId, status: "Unwatched" };
}

export function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function compareText(a: string | undefined, b: string | undefined): number {
  return (a ?? "").localeCompare(b ?? "", undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

export function getSortValue(
  entry: LiteMediaEntry,
  tracking: LiteTrackingEntry,
  key: SortKey
): string {
  if (key === "status") {
    return tracking.status;
  }

  if (key === "lang") {
    return getLanguageForEntry(entry, tracking);
  }

  if (key === "watchedYear") {
    return tracking.watchedYear ?? "";
  }

  if (key === "notes") {
    return tracking.notes ?? "";
  }

  return entry[key];
}

function parseWatchedYear(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? "";

  if (!/^\d{4}$/.test(trimmed)) {
    return null;
  }

  return Number(trimmed);
}

export function sortEntries(
  entries: LiteMediaEntry[],
  tracking: Record<string, LiteTrackingEntry>,
  sortKey: SortKey,
  sortDirection: SortDirection
): LiteMediaEntry[] {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...entries].sort((a, b) => {
    const aTracking = getTrackingForTitle(tracking, a.id);
    const bTracking = getTrackingForTitle(tracking, b.id);

    if (sortKey === "watchedYear") {
      const aYear = parseWatchedYear(aTracking.watchedYear);
      const bYear = parseWatchedYear(bTracking.watchedYear);

      if (aYear !== null && bYear !== null) {
        return (aYear - bYear) * direction;
      }

      if (aYear !== null) {
        return -1;
      }

      if (bYear !== null) {
        return 1;
      }
    }

    const result = compareText(
      getSortValue(a, aTracking, sortKey),
      getSortValue(b, bTracking, sortKey)
    );

    return result * direction;
  });
}

export function filterEntries(
  entries: LiteMediaEntry[],
  search: string
): LiteMediaEntry[] {
  const query = normalizeSearchText(search);

  return entries.filter((entry) => {
    return (
      query.length === 0 ||
      normalizeSearchText(
        `${entry.name} ${entry.media} ${entry.releaseDate} ${entry.timelineAndYear}`
      ).includes(query)
    );
  });
}
