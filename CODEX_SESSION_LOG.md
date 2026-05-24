# Codex Session Log

This file is the working handoff for future Codex sessions. Use `README.md` for the public project overview; use this file for implementation context, current state, and next steps.

## Project Context

G-LIST Lite is a standalone repo separate from the full `G-List` app. It is a compact Gundam media tracker based on the Wikipedia `Gundam` page section `TV series, films, and video`.

Repo:

```text
https://github.com/FRCGit/G-LIST-Lite
```

Live target:

```text
https://glist.francocongiusto.com
```

Workflow preference:

- Do not push unless the user explicitly asks.
- The Hostinger/GitHub deploy flow watches `main`.
- Use `git -c safe.directory=C:/Users/mainu/OneDrive/Documents/Development/Repos/GitHub/G-LIST-Lite ...` if Git reports dubious ownership in the sandbox.

## Current Stack

- Next.js 16 static export
- React 19
- TypeScript
- Supabase Auth and Postgres for cloud sync
- localStorage cache/fallback
- MediaWiki/Wikipedia sync scripts
- Hostinger static deployment from `out/`

## Current UI State

Main views:

- Table
- Poster Wall
- Notes

Table behavior:

- Sortable columns.
- Wikipedia-style rowspans through column config and `spanKey`.
- Manually resizable columns through `colgroup`.
- Desktop and compact/mobile column widths are stored separately.
- Top synced horizontal scrollbar is used for table horizontal movement.

Tracking:

- Statuses: `Unwatched`, `Watching`, `Watched`, `Up Next`.
- Watched year appears when status is `Watched`.
- Notes save per title.
- JSON export/import remains as a backup.
- Tracking entries now optionally include `updatedAt` for cloud conflict/merge behavior.

Cloud auth UI:

- User chose the "Sign-in modal" pattern.
- Signed out: compact `Sign in` button in the header.
- Clicking opens a modal with email/password inputs plus `Sign in` and `Create account`.
- Signed in: compact account chip with initial + `Synced`.
- Account chip opens dropdown with email, sync status, and `Sign out`.
- `Sign out` should not be permanently visible in the main toolbar.

## Supabase Setup

Supabase project exists and local `.env.local` was created. `.env.local` is ignored by Git and should not be committed.

Needed env vars:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Database schema lives at:

```text
supabase/schema.sql
```

It creates `public.lite_tracking` with RLS policies so users can only read/write their own rows.

Supabase table stores only user tracking:

- `user_id`
- `title_id`
- `status`
- `watched_year`
- `notes`
- `updated_at`

Poster and thumbnail metadata remain in `data/g-list-lite-media.json`; do not upload poster art to Supabase for now.

Auth notes:

- User clarified they wanted email/password auth, not magic-link-only auth.
- Modal now uses Supabase `signInWithPassword` and `signUp`.
- Forgot-password flow now uses `resetPasswordForEmail`; recovery link returns to the app and opens a new-password modal through the `PASSWORD_RECOVERY` auth event.
- Supabase email confirmation may still be required depending on project Auth settings.
- Supabase Auth redirect URLs should include:

```text
http://127.0.0.1:3001
https://glist.francocongiusto.com
```

## Deployment Context

This app is configured for static export:

```text
next.config.mjs -> output: "export"
```

Hostinger settings should be:

```text
Install: npm install
Build: npm run build
Output directory: out
```

No Node start command is needed for static deployment.

Earlier issue:

- Hostinger built successfully but live page showed unstyled/naked HTML.
- Symptom suggested CSS/JS under `/_next/static/...` was not being served correctly.
- Added `public/.htaccess`, which exports to `out/.htaccess`, to serve existing files/directories first and set CSS/JS MIME types.
- Site later appeared to work before this fix was pushed, but the fix remains a useful safeguard.

Deploy badge:

- `appVersion` is in `app/page.tsx`.
- Current known value: `v2026.05.24.1`.
- Bump before pushing visible deploy changes so the live site can be verified.

## Data Sync Context

Scripts:

```text
scripts/sync-gundam-wikipedia-lite.ts
scripts/validate-wikipedia-snapshot.ts
```

Snapshot:

```text
data/g-list-lite-media.json
```

Parser requirements:

- Respect Wikipedia `rowspan` values.
- Do not infer a new title only from the presence of a link; some valid title rows are plain text.
- Carry rowspanned `Name`, `Release date`, and `Timeline and year` values across continuation rows.
- Do not skip one-cell continuation rows. `Mobile Suit Gundam GQuuuuuuX` has a continuation row containing only `TV series: 12 episodes`.
- Plain-text title rows render as plain text, not fake links to the Gundam article.

Validation target:

```text
npm run sync:wikipedia
npm run validate:wikipedia
```

Known snapshot count from previous validation:

```text
Wikipedia rows: 94
Snapshot rows: 94
```

Spot-check these after parser/table changes:

- `Mobile Suit Gundam GQuuuuuuX`
- `Mobile Suit Gundam: The Witch from Mercury`
- `Mobile Suit Gundam SEED Freedom Zero`

## Current Uncommitted Work

As of this handoff, there is local uncommitted work for Supabase/cloud sync and UI changes:

- `@supabase/supabase-js` added.
- `app/lite-cloud-storage.ts` added.
- `supabase/schema.sql` added.
- `app/page.tsx` changed for cloud sync, modal sign-in, account menu, and `updatedAt`.
- `app/globals.css` changed for auth modal/account menu.
- `app/lite-types.ts` changed to add optional `updatedAt`.
- `package.json` and `package-lock.json` changed.
- `README.md` rewritten.
- `CODEX_SESSION_LOG.md` added.

Run before pushing:

```text
npm run lint
npm run build
```

The dev server may lock `.next` or `out` on Windows/OneDrive. If `npm run build` fails with `EPERM: operation not permitted, rmdir ...`, stop the local dev server, remove generated `.next` and `out`, and rebuild. Only remove those generated folders after verifying paths resolve inside the repo.

## Local Dev Notes

Preferred dev server:

```text
npm run dev -- --hostname 127.0.0.1 --port 3001
```

If the server needs restart after env changes:

- Stop current Node/Next processes.
- Start the dev server again.

## Recommended Next Steps

1. Review the sign-in modal/account chip UI in the browser.
2. Confirm Supabase email/password sign-in and account creation.
3. Change a status/year/note while signed in.
4. Verify rows appear in Supabase Table Editor under `lite_tracking`.
5. Add Supabase env vars to Hostinger.
6. Bump `appVersion`.
7. Run `npm run lint` and `npm run build`.
8. Commit and push only if the user asks.

Potential later refinements:

- Add account dropdown close-on-outside-click/Escape.
- Add clearer sync states such as `Saved`, `Saving`, `Offline`.
- Consider hiding poster controls until hover on desktop, but keep them visible on touch.
- Add watched-year badge on watched poster cards.
- Add a detail sheet so poster cards stay cleaner.
