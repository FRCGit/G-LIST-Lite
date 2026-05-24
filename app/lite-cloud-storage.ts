"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { LiteTrackingEntry, WatchStatus } from "./lite-types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export type CloudUser = User;

type TrackingRow = {
  user_id: string;
  title_id: string;
  status: WatchStatus;
  watched_year: string | null;
  notes: string | null;
  updated_at: string;
};

let supabaseClient: SupabaseClient | null = null;

export function isCloudConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isCloudConfigured()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl as string, supabaseKey as string, {
      auth: {
        detectSessionInUrl: true,
        flowType: "implicit",
        persistSession: true
      }
    });
  }

  return supabaseClient;
}

export function mergeTracking(
  localTracking: Record<string, LiteTrackingEntry>,
  cloudTracking: Record<string, LiteTrackingEntry>
): Record<string, LiteTrackingEntry> {
  const merged: Record<string, LiteTrackingEntry> = { ...cloudTracking };

  Object.entries(localTracking).forEach(([titleId, localEntry]) => {
    const cloudEntry = cloudTracking[titleId];

    if (!cloudEntry) {
      merged[titleId] = localEntry;
      return;
    }

    if (isNewer(localEntry.updatedAt, cloudEntry.updatedAt)) {
      merged[titleId] = localEntry;
    }
  });

  return merged;
}

export async function loadCloudTracking(
  userId: string
): Promise<Record<string, LiteTrackingEntry>> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {};
  }

  const { data, error } = await supabase
    .from("lite_tracking")
    .select("user_id,title_id,status,watched_year,notes,updated_at")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return Object.fromEntries(
    ((data ?? []) as TrackingRow[]).map((row) => [row.title_id, rowToEntry(row)])
  );
}

export async function upsertCloudTracking(
  userId: string,
  entry: LiteTrackingEntry
): Promise<void> {
  await upsertCloudTrackingBatch(userId, [entry]);
}

export async function upsertCloudTrackingBatch(
  userId: string,
  trackingEntries: LiteTrackingEntry[]
): Promise<void> {
  const supabase = getSupabaseClient();

  if (!supabase || trackingEntries.length === 0) {
    return;
  }

  const { error } = await supabase.from("lite_tracking").upsert(
    trackingEntries.map((entry) => entryToRow(userId, entry)),
    { onConflict: "user_id,title_id" }
  );

  if (error) {
    throw error;
  }
}

function rowToEntry(row: TrackingRow): LiteTrackingEntry {
  return {
    titleId: row.title_id,
    status: row.status,
    watchedYear: row.watched_year ?? undefined,
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at
  };
}

function entryToRow(userId: string, entry: LiteTrackingEntry): TrackingRow {
  return {
    user_id: userId,
    title_id: entry.titleId,
    status: entry.status,
    watched_year: entry.watchedYear ?? null,
    notes: entry.notes ?? null,
    updated_at: entry.updatedAt ?? new Date().toISOString()
  };
}

function isNewer(candidateDate: string | undefined, currentDate: string | undefined) {
  if (!candidateDate) {
    return false;
  }

  if (!currentDate) {
    return true;
  }

  return new Date(candidateDate).getTime() > new Date(currentDate).getTime();
}
