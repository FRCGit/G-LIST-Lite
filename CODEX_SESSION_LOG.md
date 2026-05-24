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
- Current known value: `v2026.05.24.3`.
- Bump before pushing visible deploy changes so the live site can be verified.

Hostinger env vars needed:

```text
NEXT_PUBLIC_SUPABASE_URL=https://pgkvxxmmadcyzjwxnags.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_iiGH-RC8VHkB4YK4CN90GA_rBmMx-Zw
```

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

## Current Git State

Latest pushed commits:

```text
c3f084e Add password recovery flow
46586ba Add Supabase cloud sync
```

`main` was pushed to `origin/main` after lint/build passed. The working tree was clean before this handoff-log update.

Implemented cloud-sync/auth work:

- Added `@supabase/supabase-js`.
- Added `app/lite-cloud-storage.ts`.
- Added `supabase/schema.sql`.
- Added Supabase email/password auth with sign-in modal, account chip, and account dropdown.
- Added forgot-password/reset-password flow with password visibility toggle.
- Added local/cloud merge behavior using `updatedAt`.
- Kept localStorage as cache/fallback, but Supabase is now the source for signed-in saved data.
- Rewrote `README.md` as a normal public project README.
- Added `exports/g-list-lite-onenote.csv` and `exports/g-list-lite-onenote.tsv`.

Password recovery caveat:

- Supabase built-in email sending is currently rate-limited. User saw `email rate limit exceeded`, `otp_expired`, and `Email link is invalid or has expired`.
- Deleting a user does not clear that rate limit; it can be project-wide/default SMTP-level.
- For testing, wait for the cooldown, disable email confirmation if appropriate, manually manage users in Supabase, or configure custom SMTP.
- Use only the newest password reset email link; older reset links expire or become invalid.
- Password reset/confirmation emails may be unreliable until the rate limit cools down or custom SMTP is configured.

Run before the next push if code changes are made:

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

## Latest UI/Deploy Notes

- Desktop title hover preview was enlarged to about 2x width with larger poster, text, spacing, and summary length.
- Mobile/touch preview remains a sheet pattern, not hover. Final current tuning is a full-screen sheet with a top image around `46dvh`, `object-fit: contain`, tighter metadata spacing, 8-line summary clamp, and `body:has(.sheet-backdrop) { overflow: hidden; }` to hide the underlying page scrollbar while the sheet is open.
- `appVersion` was bumped to `v2026.05.24.8`.
- Local `npm run lint` passed.
- Local `npm run build` passed after stopping the dev server and clearing generated `.next`/`out` folders.
- Fresh static export includes `out/.htaccess` and `out/_next/static/...`.
- Live site showing plain HTML means CSS/JS under `/_next/static/...` is not being served/deployed correctly. Verify Hostinger output directory is `out`, confirm the latest commit including `public/.htaccess` is deployed, and check whether `https://glist.francocongiusto.com/_next/static/...css` returns CSS instead of HTML/404.

Current uncommitted files after UI tuning:

```text
CODEX_SESSION_LOG.md
app/globals.css
app/page.tsx
```

## Recommended Next Steps

1. Re-run `npm run build` before deploy if more code changes are made.
2. Commit the preview-sheet/hover-card UI changes when the user is happy.
3. Push only if the user asks; Hostinger/GitHub deploy watches `main`.
4. Verify the live plain-HTML issue by checking Hostinger output directory is `out` and latest commit includes `public/.htaccess`.
5. After deploy, test `https://glist.francocongiusto.com/_next/static/...css` from the live page. It should return CSS, not `index.html` or 404.
6. Add/confirm the Supabase env vars to Hostinger if not already saved.
7. Wait for Supabase email rate limit to cool down or configure custom SMTP.
8. Confirm email/password sign-in works on the live Hostinger domain.
9. Change a status/year/note while signed in and verify rows appear in Supabase Table Editor under `lite_tracking`.
10. If live cloud sync works, decide whether to keep improving auth UX or move to poster/detail polish.

Potential later refinements:

- Add account dropdown close-on-outside-click/Escape.
- Add clearer sync states such as `Saved`, `Saving`, `Offline`.
- Consider hiding poster controls until hover on desktop, but keep them visible on touch.
- Add watched-year badge on watched poster cards.
- Add a detail sheet so poster cards stay cleaner.
