"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type {
  LanguagePreference,
  LiteTrackingEntry,
  WatchStatus
} from "./lite-types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export type CloudUser = User;

type TrackingRow = {
  user_id: string;
  title_id: string;
  status: WatchStatus;
  lang?: LanguagePreference | null;
  watched_year: string | null;
  notes: string | null;
  updated_at: string;
};

export type CloudNotepad = {
  text: string;
  updatedAt?: string;
};

type NotepadRow = {
  user_id: string;
  body: string | null;
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
    .select("user_id,title_id,status,lang,watched_year,notes,updated_at")
    .eq("user_id", userId);

  if (error) {
    if (isMissingLangColumnError(error)) {
      return loadCloudTrackingWithoutLang(supabase, userId);
    }

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
    if (isMissingLangColumnError(error)) {
      await upsertCloudTrackingBatchWithoutLang(userId, trackingEntries);
      return;
    }

    throw error;
  }
}

export function mergeNotepad(
  localNotepad: CloudNotepad,
  cloudNotepad: CloudNotepad | null
): CloudNotepad {
  if (!cloudNotepad) {
    return localNotepad;
  }

  if (isNewer(localNotepad.updatedAt, cloudNotepad.updatedAt)) {
    return localNotepad;
  }

  return cloudNotepad;
}

export async function loadCloudNotepad(
  userId: string
): Promise<CloudNotepad | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("lite_notepad")
    .select("user_id,body,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }

    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as NotepadRow;

  return {
    text: row.body ?? "",
    updatedAt: row.updated_at
  };
}

export async function upsertCloudNotepad(
  userId: string,
  notepad: CloudNotepad
): Promise<void> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("lite_notepad").upsert(
    {
      user_id: userId,
      body: notepad.text,
      updated_at: notepad.updatedAt ?? new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    if (isMissingTableError(error)) {
      return;
    }

    throw error;
  }
}

async function loadCloudTrackingWithoutLang(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, LiteTrackingEntry>> {
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

async function upsertCloudTrackingBatchWithoutLang(
  userId: string,
  trackingEntries: LiteTrackingEntry[]
): Promise<void> {
  const supabase = getSupabaseClient();

  if (!supabase || trackingEntries.length === 0) {
    return;
  }

  const { error } = await supabase.from("lite_tracking").upsert(
    trackingEntries.map((entry) => entryToRowWithoutLang(userId, entry)),
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
    lang: row.lang ?? undefined,
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
    lang: entry.lang ?? null,
    watched_year: entry.watchedYear ?? null,
    notes: entry.notes ?? null,
    updated_at: entry.updatedAt ?? new Date().toISOString()
  };
}

function entryToRowWithoutLang(
  userId: string,
  entry: LiteTrackingEntry
): Omit<TrackingRow, "lang"> {
  return {
    user_id: userId,
    title_id: entry.titleId,
    status: entry.status,
    watched_year: entry.watchedYear ?? null,
    notes: entry.notes ?? null,
    updated_at: entry.updatedAt ?? new Date().toISOString()
  };
}

function isMissingLangColumnError(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.message?.toLocaleLowerCase().includes("lang") === true
  );
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.message?.toLocaleLowerCase().includes("does not exist") === true
  );
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
