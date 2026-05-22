"use client";

import type { LiteTrackingEntry, WatchStatus } from "./lite-types";

const trackingKey = "g-list-lite-tracking-v1";

export function loadTracking(): Record<string, LiteTrackingEntry> {
  try {
    const saved = window.localStorage.getItem(trackingKey);

    if (!saved) {
      return {};
    }

    const parsed = JSON.parse(saved) as Record<string, LiteTrackingEntry>;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([titleId, entry]) => [
        titleId,
        {
          ...entry,
          status: migrateStatus(entry.status)
        }
      ])
    );
  } catch {
    return {};
  }
}

export function saveTracking(tracking: Record<string, LiteTrackingEntry>): void {
  window.localStorage.setItem(trackingKey, JSON.stringify(tracking));
}

function migrateStatus(status: string): WatchStatus {
  return status === "Skipped" ? "Up Next" : (status as WatchStatus);
}
