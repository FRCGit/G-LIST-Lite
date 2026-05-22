import type {
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
  "Skipped"
];

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

  if (key === "watchedYear") {
    return tracking.watchedYear ?? "";
  }

  return entry[key];
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
    const result = compareText(
      getSortValue(a, aTracking, sortKey),
      getSortValue(b, bTracking, sortKey)
    );

    return result * direction;
  });
}

export function filterEntries(
  entries: LiteMediaEntry[],
  tracking: Record<string, LiteTrackingEntry>,
  search: string,
  status: WatchStatus | "All"
): LiteMediaEntry[] {
  const query = normalizeSearchText(search);

  return entries.filter((entry) => {
    const entryTracking = getTrackingForTitle(tracking, entry.id);
    const matchesStatus = status === "All" || entryTracking.status === status;
    const matchesSearch =
      query.length === 0 ||
      normalizeSearchText(
        `${entry.name} ${entry.media} ${entry.releaseDate} ${entry.timelineAndYear}`
      ).includes(query);

    return matchesStatus && matchesSearch;
  });
}

