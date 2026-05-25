"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import mediaEntries from "../data/g-list-lite-media.json";
import {
  filterEntries,
  getTrackingForTitle,
  sortEntries,
  watchStatuses
} from "./lite-helpers";
import {
  getSupabaseClient,
  isCloudConfigured,
  loadCloudTracking,
  mergeTracking,
  upsertCloudTrackingBatch,
  type CloudUser
} from "./lite-cloud-storage";
import { loadTracking, saveTracking } from "./lite-storage";
import type {
  LiteMediaEntry,
  LiteTrackingEntry,
  SortDirection,
  SortKey,
  WatchStatus
} from "./lite-types";

type ViewMode = "table" | "posters" | "notes";

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
type CloudAuthState = "checking" | "signedOut" | "signedIn";
type AuthModalMode = "signIn" | "recover" | "updatePassword";

const entries = mediaEntries as LiteMediaEntry[];
const sortOptions: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "media", label: "Media" },
  { key: "releaseDate", label: "Release Date" },
  { key: "timelineAndYear", label: "Timeline" },
  { key: "status", label: "Watch Status" },
  { key: "watchedYear", label: "Year" }
];
const columnWidthsKey = "g-list-lite-column-widths-v1";
const compactColumnWidthsKey = "g-list-lite-compact-column-widths-v1";
const posterDensityKey = "g-list-lite-poster-density-v1";
const posterSizeKey = "g-list-lite-poster-size-v1";
const tableBorderAllowance = 0;
const defaultPosterSize = 170;
const appVersion = "v2026.05.25.5";
const previewCardWidth = 640;
const previewCardHeight = 520;

type TableDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastScrollLeft?: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
};

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

function loadPosterSize(): number {
  const savedSize = Number(window.localStorage.getItem(posterSizeKey));

  if (Number.isFinite(savedSize) && savedSize >= 110 && savedSize <= 260) {
    return savedSize;
  }

  const saved = window.localStorage.getItem(posterDensityKey);

  if (saved === "small" || saved === "compact") {
    return 120;
  }

  if (saved === "large") {
    return 220;
  }

  return defaultPosterSize;
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

function GridIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="4" y="4" width="6" height="6" />
      <rect x="14" y="4" width="6" height="6" />
      <rect x="4" y="14" width="6" height="6" />
      <rect x="14" y="14" width="6" height="6" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  );
}

function NotepadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 3h10a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

function RailButton({
  active,
  children,
  label,
  onClick
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={active ? "active" : ""}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="12" cy="19" r="1.4" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {hidden ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.6 6.4a1.2 1.2 0 0 1 0 1.2 17.4 17.4 0 0 1-2.2 2.8" />
          <path d="M6.2 6.5a17.3 17.3 0 0 0-3.8 4.9 1.2 1.2 0 0 0 0 1.2C3.5 14.5 7 19 12 19a9.7 9.7 0 0 0 4.1-.9" />
        </>
      ) : (
        <>
          <path d="M2.4 11.4C3.5 9.5 7 5 12 5s8.5 4.5 9.6 6.4a1.2 1.2 0 0 1 0 1.2C20.5 14.5 17 19 12 19s-8.5-4.5-9.6-6.4a1.2 1.2 0 0 1 0-1.2z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default function Home() {
  const [tracking, setTracking] = useState<Record<string, LiteTrackingEntry>>({});
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [posterSize, setPosterSize] = useState(defaultPosterSize);
  const [sortKey, setSortKey] = useState<SortKey | null>("releaseDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<LiteMediaEntry | null>(null);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
  const [compactColumnWidths, setCompactColumnWidths] = useState<ColumnWidths>(
    {}
  );
  const [usesCompactColumns, setUsesCompactColumns] = useState(false);
  const [hasLoadedLocalState, setHasLoadedLocalState] = useState(false);
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [cloudAuthState, setCloudAuthState] = useState<CloudAuthState>(
    isCloudConfigured() ? "checking" : "signedOut"
  );
  const [hasHydratedCloud, setHasHydratedCloud] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>("signIn");
  const [cloudMessage, setCloudMessage] = useState(
    isCloudConfigured() ? "Cloud sync signed out" : "Cloud sync not configured"
  );
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const tableDragRef = useRef<TableDragState | null>(null);
  const tableMomentumRef = useRef<number | null>(null);
  const trackingRef = useRef<Record<string, LiteTrackingEntry>>({});

  useEffect(() => {
    setTracking(loadTracking());
    setColumnWidths(loadColumnWidths(columnWidthsKey));
    setCompactColumnWidths(loadColumnWidths(compactColumnWidthsKey));
    setPosterSize(loadPosterSize());
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

    trackingRef.current = tracking;
  }, [hasLoadedLocalState, tracking]);

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setCloudAuthState("signedOut");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;

      setCloudUser(sessionUser);
      setCloudAuthState(sessionUser ? "signedIn" : "signedOut");
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;

      setCloudUser(sessionUser);
      setCloudAuthState(sessionUser ? "signedIn" : "signedOut");

      if (_event === "PASSWORD_RECOVERY") {
        setAuthPassword("");
        setAuthModalMode("updatePassword");
        setIsSignInOpen(true);
        setCloudMessage("Enter a new password");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedLocalState || !cloudUser) {
      setHasHydratedCloud(false);
      return;
    }

    let isCurrent = true;
    const activeCloudUser = cloudUser;

    async function hydrateCloudTracking() {
      setIsCloudBusy(true);
      setCloudMessage("Syncing cloud data");

      try {
        const cloudTracking = await loadCloudTracking(activeCloudUser.id);
        const mergedTracking = mergeTracking(trackingRef.current, cloudTracking);

        if (!isCurrent) {
          return;
        }

        setTracking(mergedTracking);
        saveTracking(mergedTracking);
        await upsertCloudTrackingBatch(
          activeCloudUser.id,
          Object.values(mergedTracking)
        );

        if (isCurrent) {
          setHasHydratedCloud(true);
          setCloudMessage(`Cloud sync on: ${activeCloudUser.email ?? "signed in"}`);
        }
      } catch {
        if (isCurrent) {
          setCloudMessage("Cloud sync needs attention");
        }
      } finally {
        if (isCurrent) {
          setIsCloudBusy(false);
        }
      }
    }

    hydrateCloudTracking();

    return () => {
      isCurrent = false;
    };
  }, [cloudUser, hasLoadedLocalState]);

  useEffect(() => {
    if (!cloudUser || !hasHydratedCloud || !hasLoadedLocalState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCloudMessage("Saving to cloud");
      upsertCloudTrackingBatch(cloudUser.id, Object.values(tracking))
        .then(() => {
          setCloudMessage(`Cloud sync on: ${cloudUser.email ?? "signed in"}`);
        })
        .catch(() => {
          setCloudMessage("Cloud save failed");
        });
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cloudUser, hasHydratedCloud, hasLoadedLocalState, tracking]);

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

  useEffect(() => {
    if (hasLoadedLocalState) {
      window.localStorage.setItem(posterSizeKey, String(posterSize));
    }
  }, [hasLoadedLocalState, posterSize]);

  useEffect(() => {
    if (cloudUser) {
      setIsSignInOpen(false);
      return;
    }

    setIsAccountMenuOpen(false);
  }, [cloudUser]);

  const visibleEntries = useMemo(() => {
    const filteredEntries = filterEntries(entries, search);

    if (!sortKey) {
      return filteredEntries;
    }

    return sortEntries(filteredEntries, tracking, sortKey, sortDirection);
  }, [search, sortDirection, sortKey, tracking]);
  const notesEntries = useMemo(() => {
    return filterEntries(entries, search).sort((a, b) => {
      const nameResult = a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base"
      });

      if (nameResult !== 0) {
        return nameResult;
      }

      return a.releaseDate.localeCompare(b.releaseDate, undefined, {
        numeric: true,
        sensitivity: "base"
      });
    });
  }, [search]);

  function updateTracking(titleId: string, update: Partial<LiteTrackingEntry>) {
    setTracking((current) => {
      const previous = getTrackingForTitle(current, titleId);
      const next: LiteTrackingEntry = {
        ...previous,
        ...update,
        updatedAt: new Date().toISOString()
      };

      if (next.status !== "Watched") {
        delete next.watchedYear;
      }

      return {
        ...current,
        [titleId]: next
      };
    });
  }

  async function signInWithPassword() {
    const supabase = getSupabaseClient();
    const email = authEmail.trim();
    const password = authPassword;

    if (!supabase || !email || !password) {
      return;
    }

    setIsCloudBusy(true);
    setCloudMessage("Signing in");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setIsCloudBusy(false);

    if (error) {
      setCloudMessage(error.message || "Sign in failed");
      return;
    }

    setCloudMessage("Signed in");
  }

  async function createAccountWithPassword() {
    const supabase = getSupabaseClient();
    const email = authEmail.trim();
    const password = authPassword;

    if (!supabase || !email || !password) {
      return;
    }

    if (password.length < 6) {
      setCloudMessage("Password must be at least 6 characters");
      return;
    }

    setIsCloudBusy(true);
    setCloudMessage("Creating account");

    const { error } = await supabase.auth.signUp({
      email,
      password
    });

    setIsCloudBusy(false);

    if (error) {
      setCloudMessage(error.message || "Account creation failed");
      return;
    }

    setCloudMessage("Account created. Check email if confirmation is required");
  }

  async function sendPasswordReset() {
    const supabase = getSupabaseClient();
    const email = authEmail.trim();

    if (!supabase || !email) {
      return;
    }

    setIsCloudBusy(true);
    setCloudMessage("Sending reset email");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    setIsCloudBusy(false);

    if (error) {
      setCloudMessage(error.message || "Password reset failed");
      return;
    }

    setCloudMessage("Check your email for a password reset link");
  }

  async function updatePassword() {
    const supabase = getSupabaseClient();
    const password = authPassword;

    if (!supabase || !password) {
      return;
    }

    if (password.length < 6) {
      setCloudMessage("Password must be at least 6 characters");
      return;
    }

    setIsCloudBusy(true);
    setCloudMessage("Updating password");

    const hasRecoverySession = await ensureRecoverySession();

    if (!hasRecoverySession) {
      setIsCloudBusy(false);
      setCloudMessage("Reset link expired. Send a new password reset email");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password
    });

    setIsCloudBusy(false);

    if (error) {
      setCloudMessage(error.message || "Password update failed");
      return;
    }

    setAuthModalMode("signIn");
    setIsSignInOpen(false);
    setCloudMessage("Password updated");
  }

  async function ensureRecoverySession() {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return false;
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) {
      return true;
    }

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      return !error;
    }

    const code = new URLSearchParams(window.location.search).get("code");

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return !error;
    }

    return false;
  }

  async function signOut() {
    const supabase = getSupabaseClient();

    if (!supabase) {
      return;
    }

    setIsCloudBusy(true);
    await supabase.auth.signOut();
    setCloudUser(null);
    setCloudAuthState("signedOut");
    setHasHydratedCloud(false);
    setCloudMessage("Cloud sync signed out");
    setIsCloudBusy(false);
  }

  function getAccountInitial() {
    return (cloudUser?.email?.trim()[0] ?? "G").toUpperCase();
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
  const mobilePosterSizeClass =
    posterSize < 150
      ? "poster-mobile-small"
      : posterSize < 210
        ? "poster-mobile-medium"
        : "poster-mobile-large";

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

  function stopTableMomentum() {
    if (tableMomentumRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(tableMomentumRef.current);
    tableMomentumRef.current = null;
  }

  function startTableMomentum(initialVelocity: number) {
    const tableScroll = tableScrollRef.current;

    if (!tableScroll || Math.abs(initialVelocity) < 0.05) {
      return;
    }

    const scroller = tableScroll;
    let velocity = initialVelocity * 0.78;
    let previousTime = performance.now();

    function coast(currentTime: number) {
      const elapsed = currentTime - previousTime;
      previousTime = currentTime;

      scroller.scrollLeft += velocity * elapsed;
      syncTableScroll("table");

      const atStart = scroller.scrollLeft <= 0;
      const atEnd =
        scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;

      velocity *= Math.pow(0.9, elapsed / 16.67);

      if (Math.abs(velocity) < 0.03 || (velocity < 0 && atStart) || (velocity > 0 && atEnd)) {
        tableMomentumRef.current = null;
        return;
      }

      tableMomentumRef.current = window.requestAnimationFrame(coast);
    }

    tableMomentumRef.current = window.requestAnimationFrame(coast);
  }

  function isInteractiveTableTarget(target: EventTarget | null) {
    return target instanceof Element
      ? Boolean(target.closest("button, input, select, textarea, a, .resize-handle"))
      : false;
  }

  function handleTablePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const tableScroll = tableScrollRef.current;

    if (
      !tableScroll ||
      event.pointerType === "touch" ||
      tableScroll.scrollWidth <= tableScroll.clientWidth ||
      isInteractiveTableTarget(event.target) ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    stopTableMomentum();
    tableScroll.setPointerCapture(event.pointerId);
    tableDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
      moved: false
    };
  }

  function handleTablePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const tableScroll = tableScrollRef.current;
    const drag = tableDragRef.current;

    if (!tableScroll || !drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const totalX = event.clientX - drag.startX;
    const totalY = event.clientY - drag.startY;

    if (!drag.moved && Math.abs(totalX) < 6) {
      return;
    }

    if (!drag.moved && Math.abs(totalY) > Math.abs(totalX)) {
      tableDragRef.current = null;
      return;
    }

    event.preventDefault();

    const now = performance.now();
    const deltaX = event.clientX - drag.lastX;
    const elapsed = Math.max(now - drag.lastTime, 1);
    const scrollDelta = -deltaX;

    tableScroll.scrollLeft += scrollDelta;
    syncTableScroll("table");

    drag.velocity = drag.velocity * 0.65 + (scrollDelta / elapsed) * 0.35;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    drag.moved = true;
  }

  function handleTablePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const tableScroll = tableScrollRef.current;
    const drag = tableDragRef.current;

    if (!tableScroll || !drag || drag.pointerId !== event.pointerId) {
      return;
    }

    tableScroll.releasePointerCapture(event.pointerId);
    tableDragRef.current = null;
    startTableMomentum(drag.velocity);
  }

  function handleTableTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const tableScroll = tableScrollRef.current;
    const touch = event.touches[0];

    if (
      !tableScroll ||
      !touch ||
      tableScroll.scrollWidth <= tableScroll.clientWidth ||
      isInteractiveTableTarget(event.target)
    ) {
      return;
    }

    stopTableMomentum();
    tableDragRef.current = {
      pointerId: -1,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastScrollLeft: tableScroll.scrollLeft,
      lastTime: performance.now(),
      velocity: 0,
      moved: false
    };
  }

  function handleTableTouchMove() {
    const tableScroll = tableScrollRef.current;
    const drag = tableDragRef.current;

    if (!tableScroll || !drag || drag.pointerId !== -1) {
      syncTableScroll("table");
      return;
    }

    const now = performance.now();
    const currentScrollLeft = tableScroll.scrollLeft;
    const previousScrollLeft = drag.lastScrollLeft ?? currentScrollLeft;
    const elapsed = Math.max(now - drag.lastTime, 1);
    const scrollDelta = currentScrollLeft - previousScrollLeft;

    if (scrollDelta !== 0) {
      drag.velocity = drag.velocity * 0.78 + (scrollDelta / elapsed) * 0.22;
      drag.lastScrollLeft = currentScrollLeft;
      drag.lastTime = now;
      drag.moved = true;
    }

    syncTableScroll("table");
  }

  function handleTableTouchEnd() {
    const drag = tableDragRef.current;

    if (!drag || drag.pointerId !== -1) {
      syncTableScroll("table");
      return;
    }

    tableDragRef.current = null;
    syncTableScroll("table");
    startTableMomentum(drag.velocity);
  }

  return (
    <main className="app-shell">
      <aside className="side-rail" aria-label="Library sections">
        <RailButton
          active={viewMode === "table"}
          label="Library table"
          onClick={() => setViewMode("table")}
        >
          <ListIcon />
        </RailButton>
        <RailButton
          active={viewMode === "posters"}
          label="Poster wall"
          onClick={() => setViewMode("posters")}
        >
          <GridIcon />
        </RailButton>
        <RailButton
          active={viewMode === "notes"}
          label="Notes"
          onClick={() => setViewMode("notes")}
        >
          <NotepadIcon />
        </RailButton>
      </aside>

      <div className="content-shell">
      <div className="content-inner" style={{ width: `${tableWidth}px` }}>
      <header className="topbar" style={{ width: `${tableWidth}px` }}>
        <div className="topbar-heading">
          <h1>G-LIST</h1>

          <div className="account-control" aria-label="Account">
            {cloudAuthState === "checking" ? (
              <button
                className="account-button"
                disabled
                type="button"
              >
                Checking
              </button>
            ) : cloudUser ? (
              <div className="account-menu-wrap">
                <button
                  aria-expanded={isAccountMenuOpen}
                  className="account-button account-chip"
                  onClick={() => setIsAccountMenuOpen((open) => !open)}
                  type="button"
                >
                  <span className="account-initial">{getAccountInitial()}</span>
                  <span>Synced</span>
                  <span aria-hidden="true">▾</span>
                </button>

                {isAccountMenuOpen ? (
                  <div className="account-menu">
                    <p className="account-email">{cloudUser.email}</p>
                    <p className="account-status">{cloudMessage}</p>
                    <button
                      className="account-menu-action"
                      disabled={isCloudBusy}
                      onClick={signOut}
                      type="button"
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                className="account-button"
                disabled={!isCloudConfigured()}
                onClick={() => setIsSignInOpen(true)}
                type="button"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        <div className="controls">
          <div className="primary-controls">
            <div className="poster-toolbar" aria-label="Library controls">
              <div className="toolbar-view-group">
                <span>View</span>
                <div className="icon-segmented" aria-label="View mode">
                  <button
                    aria-label="Table view"
                    className={viewMode === "table" ? "active" : ""}
                    onClick={() => setViewMode("table")}
                    title="Table"
                    type="button"
                  >
                    <ListIcon />
                  </button>
                  <button
                    aria-label="Poster wall view"
                    className={viewMode === "posters" ? "active" : ""}
                    onClick={() => setViewMode("posters")}
                    title="Poster Wall"
                    type="button"
                  >
                    <GridIcon />
                  </button>
                </div>
              </div>

              {viewMode === "posters" ? (
                <div className="poster-size-control">
                  <label htmlFor="poster-size">Poster Size</label>
                  <input
                    id="poster-size"
                    max="240"
                    min="110"
                    onChange={(event) => setPosterSize(Number(event.target.value))}
                    step="10"
                    type="range"
                    value={posterSize}
                  />
                  <span className="poster-size-value">
                    {posterSize < 150
                      ? "Small"
                      : posterSize < 210
                        ? "Medium"
                        : "Large"}
                  </span>
                  <div className="poster-size-labels" aria-hidden="true">
                    <span>Small</span>
                    <span>Medium</span>
                    <span>Large</span>
                  </div>
                </div>
              ) : null}

              <label className="sort-control">
                <span>Sort by</span>
                <select
                  aria-label="Sort by"
                  onChange={(event) => {
                    setSortKey(event.target.value as SortKey);
                    setSortDirection("asc");
                  }}
                  value={sortKey ?? "releaseDate"}
                >
                  {sortOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                aria-label="More options"
                className="more-button"
                type="button"
              >
                <MoreIcon />
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
      <p className="item-count">{visibleEntries.length} titles</p>

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
            onPointerCancel={handleTablePointerEnd}
            onPointerDown={handleTablePointerDown}
            onPointerMove={handleTablePointerMove}
            onPointerUp={handleTablePointerEnd}
            onScroll={() => syncTableScroll("table")}
            onTouchCancel={handleTableTouchEnd}
            onTouchEnd={handleTableTouchEnd}
            onTouchMove={handleTableTouchMove}
            onTouchStart={handleTableTouchStart}
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
      ) : viewMode === "notes" ? (
        <section className="notes-list" aria-label="Gundam title notes">
          {notesEntries.map((entry) => {
            const entryTracking = getTrackingForTitle(tracking, entry.id);

            return (
              <article className="note-card" key={entry.id}>
                <div className="note-card-header">
                  <h2>{entry.name}</h2>
                  <p>
                    {entry.media} &middot; {entry.releaseDate}
                  </p>
                </div>
                <textarea
                  aria-label={`Notes for ${entry.name}`}
                  onChange={(event) =>
                    updateTracking(entry.id, { notes: event.target.value })
                  }
                  placeholder="Notes"
                  value={entryTracking.notes ?? ""}
                />
              </article>
            );
          })}
        </section>
      ) : (
        <section
          className={`poster-grid ${mobilePosterSizeClass}`}
          style={
            {
              "--poster-size": `${posterSize}px`
            } as CSSProperties
          }
          aria-label="Gundam poster wall"
        >
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
      </div>
      </div>

      {preview ? (
        <PreviewCard
          entry={preview.entry}
          left={Math.max(
            18,
            Math.min(preview.x + 18, window.innerWidth - previewCardWidth - 18)
          )}
          tracking={getTrackingForTitle(tracking, preview.entry.id)}
          top={Math.max(
            18,
            Math.min(preview.y + 18, window.innerHeight - previewCardHeight - 18)
          )}
        />
      ) : null}

      {selectedEntry ? (
        <PreviewSheet
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          tracking={getTrackingForTitle(tracking, selectedEntry.id)}
        />
      ) : null}

      {isSignInOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => setIsSignInOpen(false)}
          role="presentation"
        >
          <section
            aria-label="Sign in to cloud sync"
            className="sign-in-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              aria-label="Close sign in"
              className="modal-close"
              onClick={() => setIsSignInOpen(false)}
              type="button"
            >
              x
            </button>
            <h2>
              {authModalMode === "recover"
                ? "Reset password"
                : authModalMode === "updatePassword"
                  ? "Set new password"
                  : "Sign in to sync"}
            </h2>
            <p>
              {authModalMode === "recover"
                ? "Enter your email and we will send a password reset link."
                : authModalMode === "updatePassword"
                  ? "Enter a new password for your account."
                  : "Use email and password to save watch status, years, and notes online."}
            </p>
            {authModalMode !== "updatePassword" ? (
              <input
                aria-label="Email for cloud sync"
                autoComplete="email"
                className="cloud-email"
                disabled={!isCloudConfigured() || isCloudBusy}
                id="cloud-sync-email"
                name="email"
                onChange={(event) => setAuthEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (authModalMode === "recover") {
                      sendPasswordReset();
                      return;
                    }

                    signInWithPassword();
                  }
                }}
                placeholder="Email"
                type="email"
                value={authEmail}
              />
            ) : null}
            {authModalMode !== "recover" ? (
              <div className="password-field">
                <input
                  aria-label="Password for cloud sync"
                  autoComplete={
                    authModalMode === "updatePassword"
                      ? "new-password"
                      : "current-password"
                  }
                  className="cloud-email password-input"
                  disabled={!isCloudConfigured() || isCloudBusy}
                  id="cloud-sync-password"
                  name="password"
                  onChange={(event) => setAuthPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (authModalMode === "updatePassword") {
                        updatePassword();
                        return;
                      }

                      signInWithPassword();
                    }
                  }}
                  placeholder={
                    authModalMode === "updatePassword"
                      ? "New password"
                      : "Password"
                  }
                  type={showAuthPassword ? "text" : "password"}
                  value={authPassword}
                />
                <button
                  aria-label={showAuthPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={() => setShowAuthPassword((visible) => !visible)}
                  type="button"
                >
                  <EyeIcon hidden={showAuthPassword} />
                </button>
              </div>
            ) : null}
            {authModalMode === "recover" ? (
              <button
                className="utility-button sign-in-submit"
                disabled={!isCloudConfigured() || isCloudBusy || !authEmail.trim()}
                onClick={sendPasswordReset}
                type="button"
              >
                Send reset link
              </button>
            ) : authModalMode === "updatePassword" ? (
              <button
                className="utility-button sign-in-submit"
                disabled={!isCloudConfigured() || isCloudBusy || !authPassword}
                onClick={updatePassword}
                type="button"
              >
                Update password
              </button>
            ) : (
              <>
                <button
                  className="utility-button sign-in-submit"
                  disabled={
                    !isCloudConfigured() ||
                    isCloudBusy ||
                    !authEmail.trim() ||
                    !authPassword
                  }
                  onClick={signInWithPassword}
                  type="button"
                >
                  Sign in
                </button>
                <button
                  className="secondary-auth-button"
                  disabled={
                    !isCloudConfigured() ||
                    isCloudBusy ||
                    !authEmail.trim() ||
                    !authPassword
                  }
                  onClick={createAccountWithPassword}
                  type="button"
                >
                  Create account
                </button>
              </>
            )}
            {authModalMode === "signIn" ? (
              <button
                className="text-auth-button"
                onClick={() => {
                  setAuthModalMode("recover");
                  setCloudMessage("Enter your account email");
                }}
                type="button"
              >
                Forgot password?
              </button>
            ) : authModalMode === "recover" ? (
              <button
                className="text-auth-button"
                onClick={() => {
                  setAuthModalMode("signIn");
                  setCloudMessage("Cloud sync signed out");
                }}
                type="button"
              >
                Back to sign in
              </button>
            ) : null}
            <p className="modal-status">{cloudMessage}</p>
          </section>
        </div>
      ) : null}

      <div className="version-badge" aria-label={`G-LIST version ${appVersion}`}>
        G-LIST {appVersion}
      </div>
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
