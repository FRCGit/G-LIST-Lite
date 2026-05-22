export type WatchStatus = "Unwatched" | "Watching" | "Watched" | "Up Next";

export type LiteTrackingEntry = {
  titleId: string;
  status: WatchStatus;
  watchedYear?: string;
  notes?: string;
};

export type LiteMediaEntry = {
  id: string;
  name: string;
  media: string;
  releaseDate: string;
  timelineAndYear: string;
  sourceUrl: string;
  pageTitle?: string;
  pageId?: number;
  extract?: string;
  thumbnailUrl?: string;
};

export type SortKey =
  | "name"
  | "media"
  | "releaseDate"
  | "timelineAndYear"
  | "status"
  | "watchedYear";

export type SortDirection = "asc" | "desc";
