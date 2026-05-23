"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mediaEntries from "../data/g-list-lite-media.json";
import {
  filterEntries,
  getTrackingForTitle,
  sortEntries,
  watchStatuses
} from "./lite-helpers";
import { loadTracking, saveTracking } from "./lite-storage";
import type {
  LiteMediaEntry,
  LiteTrackingEntry,
  SortDirection,
  SortKey,
  WatchStatus
} from "./lite-types";

type ViewMode = "table" | "posters";

type PreviewState = {
  entry: LiteMediaEntry;
  x: number;
  y: number;
};

type TableColumn = {
  key: SortKey;
  label: string;
  className: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth?: number;
  spanKey?: (entry: LiteMediaEntry) => string;
  render: (entry: LiteMediaEntry, tracking: LiteTrackingEntry) => React.ReactNode;
};

type ColumnWidths = Partial<Record<SortKey, number>>;

const entries = mediaEntries as LiteMediaEntry[];
const columnWidthsKey = "g-list-lite-column-widths-v1";
const compactColumnWidthsKey = "g-list-lite-compact-column-widths-v1";
const tableBorderAllowance = 2;

function loadColumnWidths(storageKey: string): ColumnWidths {
  try {
    const saved = window.localStorage.getItem(storageKey);

    if (!saved) {
      return {};
    }

    const parsed = JSON.parse(saved) as ColumnWidths;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveColumnWidths(storageKey: string, widths: ColumnWidths): void {
  window.localStorage.setItem(storageKey, JSON.stringify(widths));
}

function clampWidth(width: number, column: TableColumn): number {
  return Math.max(
    column.minWidth,
    Math.min(width, column.maxWidth ?? Number.POSITIVE_INFINITY)
  );
}

function getRowSpan(
  tableEntries: LiteMediaEntry[],
  startIndex: number,
  spanKey: (entry: LiteMediaEntry) => string
): number {
  const currentKey = spanKey(tableEntries[startIndex]);
  let span = 1;

  for (let index = startIndex + 1; index < tableEntries.length; index += 1) {
    if (spanKey(tableEntries[index]) !== currentKey) {
      break;
    }

    span += 1;
  }

  return span;
}

function shouldRenderSpannedCell(
  tableEntries: LiteMediaEntry[],
  index: number,
  spanKey?: (entry: LiteMediaEntry) => string
): boolean {
  if (!spanKey || index === 0) {
    return true;
  }

  return spanKey(tableEntries[index - 1]) !== spanKey(tableEntries[index]);
}

export default function Home() {
  const [tracking, setTracking] = useState<Record<string, LiteTrackingEntry>>({});
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<LiteMediaEntry | null>(null);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
  const [compactColumnWidths, setCompactColumnWidths] = useState<ColumnWidths>(
    {}
  );
  const [usesCompactColumns, setUsesCompactColumns] = useState(false);
  const [hasLoadedLocalState, setHasLoadedLocalState] = useState(false);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTracking(loadTracking());
    setColumnWidths(loadColumnWidths(columnWidthsKey));
    setCompactColumnWidths(loadColumnWidths(compactColumnWidthsKey));
    setUsesCompactColumns(window.matchMedia("(max-width: 760px)").matches);
    setHasLoadedLocalState(true);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");

    function updateColumnProfile() {
      setUsesCompactColumns(mediaQuery.matches);
    }

    updateColumnProfile();
    mediaQuery.addEventListener("change", updateColumnProfile);

    return () => {
      mediaQuery.removeEventListener("change", updateColumnProfile);
    };
  }, []);

  useEffect(() => {
    if (hasLoadedLocalState) {
      saveTracking(tracking);
    }
  }, [hasLoadedLocalState, tracking]);

  useEffect(() => {
    if (hasLoadedLocalState) {
      saveColumnWidths(columnWidthsKey, columnWidths);
    }
  }, [columnWidths, hasLoadedLocalState]);

  useEffect(() => {
    if (hasLoadedLocalState) {
      saveColumnWidths(compactColumnWidthsKey, compactColumnWidths);
    }
  }, [compactColumnWidths, hasLoadedLocalState]);

  const visibleEntries = useMemo(() => {
    const filteredEntries = filterEntries(entries, search);

    if (!sortKey) {
      return filteredEntries;
    }

    return sortEntries(filteredEntries, tracking, sortKey, sortDirection);
  }, [search, sortDirection, sortKey, tracking]);

  function updateTracking(titleId: string, update: Partial<LiteTrackingEntry>) {
    setTracking((current) => {
      const previous = getTrackingForTitle(current, titleId);
      const next: LiteTrackingEntry = { ...previous, ...update };

      if (next.status !== "Watched") {
        delete next.watchedYear;
      }

      return {
        ...current,
        [titleId]: next
      };
    });
  }

  function showPreview(entry: LiteMediaEntry, event: React.MouseEvent) {
    setPreview({
      entry,
      x: event.clientX,
      y: event.clientY
    });
  }

  function movePreview(event: React.MouseEvent) {
    setPreview((current) =>
      current
        ? {
            ...current,
            x: event.clientX,
            y: event.clientY
          }
        : current
    );
  }

  function openPreviewSheet(entry: LiteMediaEntry) {
    setSelectedEntry(entry);
  }

  const tableColumns: TableColumn[] = [
    {
      key: "name",
      label: "Name",
      className: "name-cell",
      defaultWidth: 440,
      minWidth: 260,
      maxWidth: 680,
      spanKey: (entry) => `name:${entry.name}`,
      render: (entry) => (
        <TitleCell
          entry={entry}
          onClick={openPreviewSheet}
          onMouseEnter={showPreview}
          onMouseLeave={() => setPreview(null)}
          onMouseMove={movePreview}
        />
      )
    },
    {
      key: "media",
      label: "Media",
      className: "media-cell",
      defaultWidth: 270,
      minWidth: 160,
      maxWidth: 420,
      render: (entry) => entry.media
    },
    {
      key: "releaseDate",
      label: "Release date",
      className: "release-cell",
      defaultWidth: 170,
      minWidth: 120,
      maxWidth: 260,
      spanKey: (entry) => `name:${entry.name}|release:${entry.releaseDate}`,
      render: (entry) => entry.releaseDate
    },
    {
      key: "timelineAndYear",
      label: "Timeline and year",
      className: "timeline-cell",
      defaultWidth: 310,
      minWidth: 220,
      maxWidth: 520,
      spanKey: (entry) =>
        `name:${entry.name}|timeline:${entry.timelineAndYear}`,
      render: (entry) => entry.timelineAndYear
    },
    {
      key: "status",
      label: "Watch status",
      className: "status-cell",
      defaultWidth: 174,
      minWidth: 164,
      maxWidth: 260,
      render: (entry, entryTracking) => (
        <StatusSelect
          onChange={(status) => updateTracking(entry.id, { status })}
          value={entryTracking.status}
        />
      )
    },
    {
      key: "watchedYear",
      label: "Year",
      className: "watched-year-cell",
      defaultWidth: 112,
      minWidth: 96,
      maxWidth: 180,
      render: (entry, entryTracking) => (
        <input
          aria-label={`Watched year for ${entry.name}`}
          className="year-input"
          disabled={entryTracking.status !== "Watched"}
          inputMode="numeric"
          maxLength={4}
          onChange={(event) =>
            updateTracking(entry.id, {
              watchedYear: event.target.value
            })
          }
          placeholder="Year"
          value={entryTracking.watchedYear ?? ""}
        />
      )
    }
  ];

  const resolvedColumnWidths = tableColumns.reduce<Record<SortKey, number>>(
    (widths, column) => {
      const activeWidths = usesCompactColumns ? compactColumnWidths : columnWidths;
      const fallbackWidth = usesCompactColumns
        ? column.minWidth
        : column.defaultWidth;

      widths[column.key] = clampWidth(
        activeWidths[column.key] ?? fallbackWidth,
        column
      );
      return widths;
    },
    {} as Record<SortKey, number>
  );

  const tableWidth = tableColumns.reduce(
    (total, column) => total + resolvedColumnWidths[column.key],
    0
  );
  const hasCustomColumnWidths = Object.keys(
    usesCompactColumns ? compactColumnWidths : columnWidths
  ).length > 0;

  function resizeColumn(
    column: TableColumn,
    event: React.PointerEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = resolvedColumnWidths[column.key];
    const pointerId = event.pointerId;

    event.currentTarget.setPointerCapture(pointerId);

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = clampWidth(
        startWidth + moveEvent.clientX - startX,
        column
      );

      if (usesCompactColumns) {
        setCompactColumnWidths((current) => ({
          ...current,
          [column.key]: nextWidth
        }));
        return;
      }

      setColumnWidths((current) => ({
        ...current,
        [column.key]: nextWidth
      }));
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function toggleSort(columnKey: SortKey) {
    if (sortKey !== columnKey) {
      setSortKey(columnKey);
      setSortDirection("asc");
      return;
    }

    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }

    setSortKey(null);
    setSortDirection("asc");
  }

  function resetColumnWidths() {
    if (usesCompactColumns) {
      setCompactColumnWidths({});
      window.localStorage.removeItem(compactColumnWidthsKey);
      return;
    }

    setColumnWidths({});
    window.localStorage.removeItem(columnWidthsKey);
  }

  function exportTracking() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tracking
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "g-list-tracking.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importTracking(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as {
        tracking?: Record<string, LiteTrackingEntry>;
      };

      if (!parsed.tracking || typeof parsed.tracking !== "object") {
        return;
      }

      setTracking(parsed.tracking);
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  function syncTableScroll(source: "top" | "table") {
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;

    if (!topScroll || !tableScroll) {
      return;
    }

    if (source === "top") {
      tableScroll.scrollLeft = topScroll.scrollLeft;
      return;
    }

    topScroll.scrollLeft = tableScroll.scrollLeft;
  }

  return (
    <main className="app-shell">
      <header className="topbar" style={{ width: `${tableWidth}px` }}>
        <div>
          <h1>G-LIST</h1>
          <p>{visibleEntries.length} titles</p>
        </div>

        <div className="controls">
          <div className="segmented" aria-label="View mode">
            <button
              className={viewMode === "table" ? "active" : ""}
              onClick={() => setViewMode("table")}
              type="button"
            >
              Table
            </button>
            <button
              className={viewMode === "posters" ? "active" : ""}
              onClick={() => setViewMode("posters")}
              type="button"
            >
              Poster Wall
            </button>
          </div>

          {viewMode === "table" && hasCustomColumnWidths ? (
            <button
              className="reset-columns"
              onClick={resetColumnWidths}
              type="button"
            >
              Reset columns
            </button>
          ) : null}

          <button className="utility-button" onClick={exportTracking} type="button">
            Export
          </button>
          <button
            className="utility-button"
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            Import
          </button>
          <input
            accept="application/json"
            aria-label="Import tracking JSON"
            className="hidden-file-input"
            onChange={(event) => importTracking(event.target.files?.[0])}
            ref={importInputRef}
            type="file"
          />

          <input
            aria-label="Search titles"
            className="search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            type="search"
            value={search}
          />
        </div>
      </header>

      {entries.length === 0 ? (
        <section className="empty-state">
          <h2>No media snapshot yet</h2>
          <p>Run npm run sync:wikipedia to create data/g-list-lite-media.json.</p>
        </section>
      ) : viewMode === "table" ? (
        <section
          className="table-shell"
          style={{ width: `${tableWidth + tableBorderAllowance}px` }}
          aria-label="Gundam media table"
        >
          <div
            className="top-scrollbar"
            onScroll={() => syncTableScroll("top")}
            ref={topScrollRef}
          >
            <div style={{ width: `${tableWidth}px` }} />
          </div>
          <div
            className="table-wrap"
            onScroll={() => syncTableScroll("table")}
            ref={tableScrollRef}
          >
            <table style={{ width: `${tableWidth}px` }}>
            <colgroup>
              {tableColumns.map((column) => (
                <col
                  className={`column-${column.key}`}
                  key={column.key}
                  style={{ width: `${resolvedColumnWidths[column.key]}px` }}
                />
              ))}
            </colgroup>
            <thead>
              <tr>
                {tableColumns.map((column) => (
                  <th className={column.className} key={column.key}>
                    <button
                      className="sort-button"
                      onClick={() => toggleSort(column.key)}
                      type="button"
                    >
                      <span>{column.label}</span>
                      <span
                        aria-hidden="true"
                        className={`sort-indicator ${
                          sortKey === column.key
                            ? `sort-${sortDirection}`
                            : "sort-default"
                        }`}
                      />
                    </button>
                    <button
                      aria-label={`Resize ${column.label} column`}
                      className="resize-handle"
                      onClick={(event) => event.preventDefault()}
                      onPointerDown={(event) => resizeColumn(column, event)}
                      type="button"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry, index) => {
                const entryTracking = getTrackingForTitle(tracking, entry.id);

                return (
                  <tr key={entry.id}>
                    {tableColumns.map((column) => {
                      if (
                        !shouldRenderSpannedCell(
                          visibleEntries,
                          index,
                          column.spanKey
                        )
                      ) {
                        return null;
                      }

                      const rowSpan = column.spanKey
                        ? getRowSpan(visibleEntries, index, column.spanKey)
                        : 1;

                      return (
                        <td
                          className={column.className}
                          key={column.key}
                          rowSpan={rowSpan}
                        >
                          {column.render(entry, entryTracking)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="poster-grid" aria-label="Gundam poster wall">
          {visibleEntries.map((entry) => {
            const entryTracking = getTrackingForTitle(tracking, entry.id);

            return (
              <article
                className="poster-card"
                key={entry.id}
                onClick={() => {
                  if (window.matchMedia("(max-width: 760px)").matches) {
                    openPreviewSheet(entry);
                  }
                }}
                onMouseEnter={(event) => showPreview(entry, event)}
                onMouseLeave={() => setPreview(null)}
                onMouseMove={movePreview}
              >
                <a
                  href={entry.pageTitle ? entry.sourceUrl : undefined}
                  rel="noreferrer"
                  target={entry.pageTitle ? "_blank" : undefined}
                >
                  <div className="poster-frame">
                    <span>{entry.name}</span>
                  </div>
                  <h2>{entry.name}</h2>
                </a>
                <p>
                  {entry.media} · {entry.releaseDate}
                </p>
                <PosterTrackingControls
                  entry={entry}
                  onChange={updateTracking}
                  tracking={entryTracking}
                />
              </article>
            );
          })}
        </section>
      )}

      {preview ? (
        <PreviewCard
          entry={preview.entry}
          left={Math.min(preview.x + 18, window.innerWidth - 340)}
          tracking={getTrackingForTitle(tracking, preview.entry.id)}
          top={Math.min(preview.y + 18, window.innerHeight - 360)}
        />
      ) : null}

      {selectedEntry ? (
        <PreviewSheet
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          tracking={getTrackingForTitle(tracking, selectedEntry.id)}
        />
      ) : null}
    </main>
  );
}

function PosterTrackingControls({
  entry,
  onChange,
  tracking
}: {
  entry: LiteMediaEntry;
  onChange: (titleId: string, update: Partial<LiteTrackingEntry>) => void;
  tracking: LiteTrackingEntry;
}) {
  return (
    <div
      className={`poster-controls ${
        tracking.status === "Watched" ? "has-year" : ""
      }`}
    >
      <StatusSelect
        onChange={(status) => onChange(entry.id, { status })}
        value={tracking.status}
      />
      {tracking.status === "Watched" ? (
        <input
          aria-label={`Watched year for ${entry.name}`}
          className="year-input"
          inputMode="numeric"
          maxLength={4}
          onChange={(event) =>
            onChange(entry.id, {
              watchedYear: event.target.value
            })
          }
          placeholder="Year"
          value={tracking.watchedYear ?? ""}
        />
      ) : null}
    </div>
  );
}

function TitleCell({
  onClick,
  entry,
  onMouseEnter,
  onMouseLeave,
  onMouseMove
}: {
  entry: LiteMediaEntry;
  onClick: (entry: LiteMediaEntry) => void;
  onMouseEnter: (entry: LiteMediaEntry, event: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onMouseMove: (event: React.MouseEvent) => void;
}) {
  if (!entry.pageTitle) {
    return (
      <span
        onClick={() => onClick(entry)}
        onMouseEnter={(event) => onMouseEnter(entry, event)}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
      >
        {entry.name}
      </span>
    );
  }

  return (
    <a
      href={entry.sourceUrl}
      onClick={(event) => {
        if (window.matchMedia("(max-width: 760px)").matches) {
          event.preventDefault();
          onClick(entry);
        }
      }}
      onMouseEnter={(event) => onMouseEnter(entry, event)}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      rel="noreferrer"
      target="_blank"
    >
      {entry.name}
    </a>
  );
}

function PreviewSheet({
  entry,
  onClose,
  tracking
}: {
  entry: LiteMediaEntry;
  onClose: () => void;
  tracking: LiteTrackingEntry;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <section
        aria-modal="true"
        className="preview-sheet"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button className="sheet-close" onClick={onClose} type="button">
          Close
        </button>
        <div className="sheet-content">
          <div className="preview-media">
            {entry.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" src={entry.thumbnailUrl} />
            ) : (
              <span>{entry.name}</span>
            )}
          </div>
          <div className="preview-body">
            <h2>{entry.name}</h2>
            <p className="extract">{entry.extract ?? "No summary available."}</p>
            <dl>
              <div>
                <dt>Media</dt>
                <dd>{entry.media}</dd>
              </div>
              <div>
                <dt>Release</dt>
                <dd>{entry.releaseDate}</dd>
              </div>
              <div>
                <dt>Timeline</dt>
                <dd>{entry.timelineAndYear}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {tracking.status}
                  {tracking.watchedYear ? `, ${tracking.watchedYear}` : ""}
                </dd>
              </div>
            </dl>
            {entry.pageTitle ? (
              <a
                className="sheet-link"
                href={entry.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open Wikipedia
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusSelect({
  onChange,
  value
}: {
  onChange: (status: WatchStatus) => void;
  value: WatchStatus;
}) {
  return (
    <select
      aria-label="Watch status"
      className={`status-select status-${value.toLowerCase().replace(" ", "-")}`}
      onChange={(event) => onChange(event.target.value as WatchStatus)}
      value={value}
    >
      {watchStatuses.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}

function PreviewCard({
  entry,
  left,
  top,
  tracking
}: {
  entry: LiteMediaEntry;
  left: number;
  top: number;
  tracking: LiteTrackingEntry;
}) {
  return (
    <aside className="preview-card" style={{ left, top }}>
      <div className="preview-media">
        {entry.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={entry.thumbnailUrl} />
        ) : (
          <span>{entry.name}</span>
        )}
      </div>
      <div className="preview-body">
        <h2>{entry.name}</h2>
        <p className="extract">{entry.extract ?? "No summary available."}</p>
        <dl>
          <div>
            <dt>Media</dt>
            <dd>{entry.media}</dd>
          </div>
          <div>
            <dt>Release</dt>
            <dd>{entry.releaseDate}</dd>
          </div>
          <div>
            <dt>Timeline</dt>
            <dd>{entry.timelineAndYear}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {tracking.status}
              {tracking.watchedYear ? `, ${tracking.watchedYear}` : ""}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
