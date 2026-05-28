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
- Current known value: `v2026.05.25.5`.
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
- After pushing `v2026.05.24.8`, live HTML showed the new version but assets were inconsistent: CSS sometimes returned `200 text/css`, while several chunk URLs returned `403` or stale/mismatched names. Added explicit `public/.htaccess` allow rules for asset extensions and `RewriteRule ^_next/static/ - [L]`, then bumped to `v2026.05.24.9` for a fresh deploy.
- `/_next/static/...` continued returning `403` on Hostinger, so a stronger workaround was added: `package.json` now runs `postbuild`, which calls `scripts/prepare-hostinger-export.mjs`. The script copies `out/_next/static` to `out/next-static` and rewrites exported `.html`, `.js`, `.json`, and `.txt` references from `/_next/static/` to `/next-static/`. This avoids Hostinger's blocked `_next` path while keeping the standard Next export available.
- Hostinger build for `v2026.05.24.10` failed because `scripts/prepare-hostinger-export.mjs` expected `out/_next/static`, but Hostinger's postbuild environment did not have that directory. Script was updated to fall back to `.next/static` and version bumped to `v2026.05.24.11`.
- Hostinger build for `v2026.05.24.11` failed because `out` itself was missing when `postbuild` ran. Script was updated again to create `out` from `.next/server/app` fallback files (`index.html`, RSC text files, route segments, and `_not-found` output) before copying static assets/replacing paths. Version bumped to `v2026.05.24.12`.
- `v2026.05.24.12` deployed but live cache-busted HTML still came from Next server output and referenced `/_next/static`. Added production `assetPrefix: "/next-static"` in `next.config.mjs` and updated `prepare-hostinger-export.mjs` to copy chunks to both `out/next-static/_next/static` and `public/next-static/_next/static`. `public/next-static` is ignored because it is generated during build. Version bumped to `v2026.05.24.13`.
- `eslint.config.mjs` also ignores `public/next-static/**` so local lint does not scan generated minified Next chunks after a build.
- On May 25, live HTML finally showed `v2026.05.24.13` and `/next-static/_next/static/...`, but every referenced asset still returned `403`. Conclusion: Hostinger blocks any public URL containing `_next`, even nested under another prefix. New workaround rewrites built `out`, `.next/server/app`, and generated public chunk files to use `/glist-assets/static/...` with no `_next` segment at all; chunks are copied to `out/glist-assets/static` and `public/glist-assets/static`. `.gitignore` and ESLint ignore `public/glist-assets/**`. Version bumped to `v2026.05.25.1`.
- The cache-busted URL `/?v=2026052501` worked, but bare `/` still served old plain HTML with `Age: 106368`, `Cache-Control: s-maxage=31536000`, and old `/_next/static` references. Added `.htaccess` `mod_headers` rules for `.html`/`.txt` to set `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache`, and `Expires: 0`; bumped to `v2026.05.25.2`.
- After `v2026.05.25.2`, bare `/` still returned old `v2026.05.24` HTML with `x-hcdn-cache-status: HIT`, `Age: 78788`, `Cache-Control: s-maxage=31536000`, and old `/_next/static`. Cache-busted URLs were intermittently `403`, likely Hostinger/WAF/CDN behavior. Added Next-level `headers()` in `next.config.mjs` with no-store/no-cache headers for all paths because Hostinger appears to serve Next output and may ignore `.htaccess`. Bumped to `v2026.05.25.3`.
- User found correct Hostinger CDN page under Performance -> CDN with a **Flush cache** button. No-cache preview showed the styled latest app at `v2026.05.25.3`, confirming code/deploy worked and bare `/` was stale CDN cache.
- Mobile table horizontal swipe felt delayed until finger lift. Cause was custom touch drag plus `touch-action: pan-y` fighting native mobile horizontal overflow. Updated table touch behavior to let native mobile scroll handle horizontal pan immediately, disabled custom pointer drag for touch pointers, and changed coarse-pointer CSS to `touch-action: pan-x pan-y`. Desktop/mouse custom drag remains. Bumped to `v2026.05.25.4`.
- User then reported mobile horizontal swipe moved while dragging but did not continue/glide after finger lift. Added passive touch velocity tracking based on native `scrollLeft` changes and feeds that velocity into existing table momentum on touch end. Native drag is still used during finger movement; synthetic momentum only starts after lift. Bumped to `v2026.05.25.5`.
- User later reported the site still displayed plain HTML after clearing cache. Hostinger resource page showed **99% main resources used** while disk and inodes were fine (`0.23 GB / 50 GB`, `4,244 / 600,000`). This likely contributed to intermittent `503 Service Unavailable` responses during cache-busted live checks.
- The latest Hostinger build log user pasted still showed the older postbuild output:

```text
Prepared Hostinger export: created out from .next/server/app, copied .next/static to out/next-static and rewrote 15 files.
```

That means Hostinger had **not yet built the latest pushed commit** `9d233ab Serve Next assets from public prefix`, because the current script should log both destinations:

```text
out/next-static/_next/static
public/next-static/_next/static
```

Current suspicion: Hostinger is either deploying an older checkout/commit, still running a stale build, or resource pressure is preventing a clean fresh deploy. The cache-clear button used by the user is the correct area, but clearing cache cannot fix the old HTML/assets until the latest commit is actually deployed.

Before resuming deploy debugging:

1. Confirm Hostinger deploy commit is `9d233ab` or newer.
2. If Hostinger offers the free **Boost now** resource boost, use it before redeploying.
3. Trigger a fresh redeploy from `main`.
4. Confirm build log contains `public/next-static/_next/static`.
5. Then clear Hostinger cache again.
6. Test a cache-busted URL such as `https://glist.francocongiusto.com/?v=2026052413`.
7. Expected latest live HTML should show `v2026.05.24.13` and reference `/next-static/_next/static/...`, never `/_next/static/...`.

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

## 2026-05-25 Handoff Update

Current local UI/version state before push:

- `appVersion` is `v2026.05.25.8`.
- iPad/tablet toolbar wrapping was improved so the sort select no longer clips in landscape.
- Touch/tablet poster taps now open the preview sheet instead of jumping straight to Wikipedia.
- Preview sheet has an explicit close button.
- The unused three-dot toolbar button was removed.
- Desktop and tablet side-rail icon alignment was tuned.
- Import/export moved out of the main toolbar into a left-rail backup icon menu.
- The backup menu closes when clicking/tapping outside it.
- Mobile rail backup menu opens under the icon instead of using the desktop side flyout.
- Poster wall card artwork was intentionally **not** enabled; poster cards remain placeholder frames for now.

Wikipedia table verification:

- Ran `npm run validate:wikipedia`.
- Result: `Wikipedia rows: 94`, `Snapshot rows: 94`.
- Validator reported: `Snapshot matches the live Wikipedia media table.`
- The app snapshot in `data/g-list-lite-media.json` matches the live Wikipedia table fields/order for `Name`, `Media`, `Release date`, and `Timeline and year`.

README update:

- README was rewritten into a more standard project format.
- Deployment notes now describe the current Hostinger `/glist-assets/static/...` workaround instead of the older `_next/static` deployment assumption.
- Roadmap now records that poster art in poster wall cards is deferred until the source, matching rules, attribution, and fallback behavior are decided.

Recommended next work:

1. If poster art is revisited, use official APIs rather than scraping. A hybrid TMDB/manual override/Wikimedia fallback plan is likely best.
2. Consider adding outside-click/Escape handling for the account dropdown too.
3. Add clearer cloud sync states such as `Saved`, `Saving`, and `Offline`.

## 2026-05-26 Handoff Update

Implemented after user request:

- Added outside-click and Escape-key closing for the signed-in account dropdown.
- Added explicit cloud sync UI states: `Checking`, `Syncing`, `Saving`, `Saved`, `Offline`, `Needs attention`, `Signed out`, and `Local`.
- Account chip now displays the current sync state instead of always saying `Synced`.
- Account dropdown now shows a small status dot and a clearer detail message, such as `Saved to user@example.com`.
- Local edits still save to `localStorage`; when offline, cloud sync is marked `Offline` and will retry when the browser returns online.
- Visible deploy badge bumped to `v2026.05.26.1`.

Status rename note:

- Renaming `Up Next` to `To Watch` should not be done by simply changing the stored value, because Supabase currently has a check constraint allowing `Up Next`.
- Safest option is to keep storing `Up Next` and display `To Watch` in UI labels.
- If the database value itself must change later, migrate existing rows and update the Supabase check constraint in the same deploy.
- Implemented this safe UI-only rename in `v2026.05.26.2`; select options and preview status text now display `To Watch`, while storage/Supabase still use `Up Next`.
- `v2026.05.26.3` reduces account-chip flicker when returning to the G-LIST browser tab by preserving the stable sync state for same-user Supabase auth refresh events.
- `v2026.05.26.4` changes the UI-only status label from `Watch Next` to `To Watch`; storage/Supabase remain on `Up Next`.
- `v2026.05.26.5` adds a table `Lang` column with a dropdown for empty, `Eng`, `Sub`, and `Jpn`.
- `lang` is stored on `LiteTrackingEntry` and in Supabase as `lite_tracking.lang`; cloud sync falls back gracefully if the live table has not yet been migrated.
- First-pass language defaults are implemented in `app/lite-helpers.ts`: known dubbed titles default to `Eng`, obscure/no-English-release items default to `Jpn`, and remaining titles default to `Sub`.
- Apply `supabase/schema.sql` in Supabase to persist `lang` in the cloud database. Until then, the UI/localStorage work, but cloud sync omits `lang`.
- The local loader migrates older `eng dub`, `eng sub`, and `jap` values to `Eng`, `Sub`, and `Jpn`.
- `v2026.05.26.7` keeps `Year` directly after `Watch status` and places `Lang` at the far right.
- `v2026.05.26.8` changes the Notes view to a single fluid local notepad stored under `g-list-lite-notepad-v1`.
- Added a table `Notes` column after `Year`; it opens a responsive per-title note popup. These row notes remain in tracking data and can sync through Supabase.
- Watched-year sorting now treats real four-digit years as valid values and keeps blanks or placeholders such as `?` below valid years in both ascending and descending sorts.
- `v2026.05.26.9` moves the table `Notes` column to the far right, after `Lang`.
- `v2026.05.26.10` increases mobile horizontal table momentum so left/right swipes coast farther after finger lift while preserving native vertical scroll.

Verification:

- `npm run lint` passed.
- `npm run build` passed after clearing generated `.next` and `out` folders inside the repo.
- Postbuild log confirmed assets copied to `out/glist-assets/static` and `public/glist-assets/static`, with built references rewritten.

## 2026-05-27 Handoff Update

Notepad save fix:

- The standalone Notes view notepad still uses local browser storage under `g-list-lite-notepad-v1`.
- Added dedicated `loadNotepadText` and `saveNotepadText` helpers with storage error handling.
- The notepad textarea now saves immediately inside its `onChange` handler, while the existing state-effect save remains as a backup.
- `npm run lint` passed after rerunning outside the sandbox because Node hit a Windows `EPERM` resolving the OneDrive user path.
- Local dev server was started on `http://127.0.0.1:3001` and returned HTTP 200.

Table column order update:

- Current table order: `Name`, `Release date`, `Watch status`, `Year`, `Media`, `Timeline and year`, `Lang`, `Notes`.
- Previous table order to remember/restore if needed: `Name`, `Media`, `Release date`, `Timeline and year`, `Watch status`, `Year`, `Lang`, `Notes`.
- Intermediate order before moving release date second: `Name`, `Watch status`, `Year`, `Release date`, `Media`, `Timeline and year`, `Lang`, `Notes`.

Version badge placement:

- The visible `G-LIST v...` badge is now a static bottom-right footer inside the content shell.
- Previous behavior to remember/restore if needed: the version badge was `position: fixed` in the bottom-right viewport corner.

Mobile table width/status fit:

- Mobile now removes most outer table chrome/gutter by setting the app shell margin to `0`, removing side borders, and reducing content padding to `4px`.
- Compact table widths now use explicit `compactWidth` values instead of each column's desktop `minWidth`.
- Compact first columns are tuned so `Name` plus `Watch status` fits better on iPhone XR-width viewports: `Name` uses `228px`, `Watch status` uses `142px`, and the mobile status select fills its cell instead of forcing `15ch`.
- Previous compact behavior to remember/restore if needed: compact fallback widths used each column's `minWidth`, with `Name` at `260px` and `Watch status` at `164px`.
- When the app loads into mobile/compact mode or switches into it, any saved compact `Name` width is cleared so the first column returns to its narrow compact default.
- Mobile column resizing now clamps against compact widths instead of desktop minimum widths.
- Follow-up mobile tuning made the first three columns fit on-screen better: compact `Name` is now `206px`, `Watch status` is `116px`, and `Year` is `74px`.
- Mobile status/year controls use smaller font and tighter horizontal padding so `Unwatched` and four-digit years fit in the tighter cells.
- After moving `Release date` to the second column, mobile compact widths were tightened again so `Watch status` fits in view: `Name` is now `190px`, `Release date` is `94px`, `Watch status` remains `116px`, and `Year` remains `74px`.
- Mobile mode now clears saved compact widths for `Name`, `Release date`, `Watch status`, and `Year` so older wider local column settings do not override the tuned mobile defaults.

Desktop default column widths:

- Desktop column-width storage key was bumped from `g-list-lite-column-widths-v1` to `g-list-lite-column-widths-v2` so the new default desktop layout loads even if older desktop widths were saved locally.
- Desktop defaults were matched to the user's narrowed local layout from the May 27 screenshot: `Name` 348, `Release date` 150, `Watch status` 164, `Year` 96, `Media` 198, `Timeline and year` 254, `Lang` 112, `Notes` 92.
- Previous desktop defaults to remember/restore if needed: `Name` 440, `Release date` 170, `Watch status` 174, `Year` 112, `Media` 270, `Timeline and year` 310, `Lang` 130, `Notes` 92.

Mobile preview text tuning:

- Mobile preview sheet summary text (`.extract`) was bumped from `13px` to `15px` for readability.
- Mobile preview metadata rows (`dl`) were reduced to `15px` so the media/release/timeline/status details fit a bit better below the summary.

## 2026-05-28 Handoff Update

Standalone notepad cloud sync:

- The standalone Notes view notepad now remains cached in local browser storage under `g-list-lite-notepad-v1`, with a new local timestamp key `g-list-lite-notepad-updated-at-v1`.
- Added Supabase table `public.lite_notepad` in `supabase/schema.sql`; apply the schema in Supabase before expecting cross-device notepad sync.
- Cloud notepad sync is no-op safe if the live database has not been migrated yet, so tracking sync should keep working while `lite_notepad` is missing.
- Sign-in hydration now loads tracking and the standalone notepad together, merges by `updatedAt`, saves the merged notepad locally, and upserts it to Supabase.
- Standalone notepad edits are debounced and saved to Supabase when signed in, while localStorage remains the offline/cache fallback.

Mobile table momentum:

- The stronger May 28 momentum tuning was reverted to the earlier values: lift velocity multiplier `1.35`, friction `0.955`, start threshold `0.035`, and stop threshold `0.018`.
- Touch velocity tracking was restored to the earlier blend: previous velocity weight `0.62`, latest native scroll delta weight `0.38`.
- Actual mobile issue was touches that started on title links in the `Name` column. Touch swipes now allow links through the tracking path, while desktop/mouse drag still treats links as interactive targets.
