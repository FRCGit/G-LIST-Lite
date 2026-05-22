"use client";

import { useEffect, useMemo, useState } from "react";
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
const tableBorderAllowance = 2;

function loadColumnWidths(): ColumnWidths {
  try {
    const saved = window.localStorage.getItem(columnWidthsKey);

    if (!saved) {
      return {};
    }

    const parsed = JSON.parse(saved) as ColumnWidths;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveColumnWidths(widths: ColumnWidths): void {
  window.localStorage.setItem(columnWidthsKey, JSON.stringify(widths));
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
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
  const [hasLoadedLocalState, setHasLoadedLocalState] = useState(false);

  useEffect(() => {
    setTracking(loadTracking());
    setColumnWidths(loadColumnWidths());
    setHasLoadedLocalState(true);
  }, []);

  useEffect(() => {
    if (hasLoadedLocalState) {
      saveTracking(tracking);
    }
  }, [hasLoadedLocalState, tracking]);

  useEffect(() => {
    if (hasLoadedLocalState) {
      saveColumnWidths(columnWidths);
    }
  }, [columnWidths, hasLoadedLocalState]);

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
      widths[column.key] = clampWidth(
        columnWidths[column.key] ?? column.defaultWidth,
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
          className="table-wrap"
          style={{ width: `${tableWidth + tableBorderAllowance}px` }}
          aria-label="Gundam media table"
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
        </section>
      ) : (
        <section className="poster-grid" aria-label="Gundam poster wall">
          {visibleEntries.map((entry) => {
            const entryTracking = getTrackingForTitle(tracking, entry.id);

            return (
              <article
                className="poster-card"
                key={entry.id}
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
                    {entry.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={entry.thumbnailUrl} />
                    ) : (
                      <span>{entry.name}</span>
                    )}
                  </div>
                  <h2>{entry.name}</h2>
                </a>
                <p>
                  {entry.media} · {entry.releaseDate}
                </p>
                <div className="poster-controls">
                  <StatusSelect
                    onChange={(status) => updateTracking(entry.id, { status })}
                    value={entryTracking.status}
                  />
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
                </div>
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
    </main>
  );
}

function TitleCell({
  entry,
  onMouseEnter,
  onMouseLeave,
  onMouseMove
}: {
  entry: LiteMediaEntry;
  onMouseEnter: (entry: LiteMediaEntry, event: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onMouseMove: (event: React.MouseEvent) => void;
}) {
  if (!entry.pageTitle) {
    return (
      <span
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
