"use client";

import type { LiteTrackingEntry } from "./lite-types";

const trackingKey = "g-list-lite-tracking-v1";

export function loadTracking(): Record<string, LiteTrackingEntry> {
  try {
    const saved = window.localStorage.getItem(trackingKey);

    if (!saved) {
      return {};
    }

    const parsed = JSON.parse(saved) as Record<string, LiteTrackingEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveTracking(tracking: Record<string, LiteTrackingEntry>): void {
  window.localStorage.setItem(trackingKey, JSON.stringify(tracking));
}

