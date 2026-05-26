export type WatchStatus = "Unwatched" | "Watching" | "Watched" | "Up Next";
export type LanguagePreference = "" | "Eng" | "Sub" | "Jpn";

export type LiteTrackingEntry = {
  titleId: string;
  status: WatchStatus;
  lang?: LanguagePreference;
  watchedYear?: string;
  notes?: string;
  updatedAt?: string;
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
  | "lang"
  | "notes"
  | "watchedYear";

export type SortDirection = "asc" | "desc";
