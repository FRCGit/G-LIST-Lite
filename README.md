# G-LIST

<img width="2538" height="1226" alt="image" src="https://github.com/user-attachments/assets/5f1b47b5-cb98-447e-a954-f99c3ade2318" />



G-LIST is a compact Gundam media tracker built from the `TV series, films, and video` table on Wikipedia's Gundam page. It keeps the familiar table-first structure, adds personal watch tracking, and optionally syncs that tracking data through Supabase.

Live site:

```text
https://glist.francocongiusto.com
```

## Features

- Sortable Gundam media table that mirrors the Wikipedia table layout.
- Row grouping for titles with multiple media rows.
- Poster wall view with adjustable card sizing.
- Notes view for per-title notes.
- Desktop hover previews and touch/mobile preview sheets.
- Watch statuses: `Unwatched`, `Watching`, `Watched`, and `To Watch`.
- Per-title `lang` dropdown with `Eng`, `Sub`, and `Jpn` options.
- Per-title notes popup from the table.
- Simple notepad view for free-form notes, cached locally and synced when signed in.
- Watched-year field for completed titles.
- JSON backup import/export from the rail backup menu.
- Local `localStorage` persistence.
- Optional Supabase email/password auth and cloud sync.

## Data Source

The media list comes from Wikipedia's Gundam page. The local snapshot is stored in:

```text
data/g-list-lite-media.json
```

The snapshot includes the table fields used by the app:

- `name`
- `media`
- `releaseDate`
- `timelineAndYear`
- `sourceUrl`
- optional Wikipedia summary and thumbnail metadata for previews

Validate the snapshot against the live Wikipedia table with:

```bash
npm run validate:wikipedia
```

Refresh the snapshot with:

```bash
npm run sync:wikipedia
```

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Supabase Auth and Postgres for optional cloud sync
- MediaWiki/Wikipedia APIs for media data
- Cheerio for table parsing and validation
- ESLint 9
- Static export deployment for Hostinger

## Project Structure

```text
app/
  page.tsx                 Main UI
  globals.css              App styling
  lite-cloud-storage.ts    Supabase auth/sync helpers
  lite-helpers.ts          Filtering, sorting, tracking helpers
  lite-storage.ts          localStorage cache/fallback
  lite-types.ts            Shared TypeScript types
data/
  g-list-lite-media.json   Wikipedia media snapshot
exports/
  g-list-lite-onenote.csv  Spreadsheet export
  g-list-lite-onenote.tsv  OneNote-friendly export
scripts/
  sync-gundam-wikipedia-lite.ts
  validate-wikipedia-snapshot.ts
  prepare-hostinger-export.mjs
supabase/
  schema.sql               Cloud tracking table and RLS policies
public/
  .htaccess                Static hosting rewrite/MIME/cache rules
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the local dev server:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open:

```text
http://127.0.0.1:3001
```

Port `3001` is commonly used locally because the full G-List app may occupy port `3000`.

## Environment Variables

Cloud sync is optional. Without Supabase env vars, the app still works with local-only tracking.

Create `.env.local` for local Supabase sync:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Do not commit `.env.local`.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Add redirect URLs for local and production auth:

```text
http://127.0.0.1:3001
https://glist.francocongiusto.com
```

Supabase stores only personal tracking data:

- user id
- title id
- watch status
- watched year
- notes
- updated timestamp

It also stores one standalone notepad row per user:

- user id
- note body
- updated timestamp

The public media snapshot and preview metadata are not stored per user.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run sync:wikipedia
npm run validate:wikipedia
```

## Deployment

The app is configured for static export:

```js
// next.config.mjs
output: "export"
```

Hostinger should use:

```text
Install: npm install
Build: npm run build
Output directory: out
```

No Node start command is required for the static site.

Hostinger has blocked Next's normal `_next` asset paths in this project, so `scripts/prepare-hostinger-export.mjs` copies and rewrites built assets to:

```text
out/glist-assets/static
public/glist-assets/static
```

After deployment, if the live site shows plain HTML, flush the Hostinger CDN cache under **Performance -> CDN -> Flush cache** and confirm the deployed HTML references `/glist-assets/static/...`.

## Roadmap

- Add proper poster art to poster wall cards later. Current poster view intentionally keeps placeholder frames until the art source, matching rules, attribution, and fallback behavior are decided.
- Consider TMDB or another official API for poster metadata, with Wikipedia/Wikimedia as fallback and manual overrides for Gundam edge cases.
- Add source/attribution handling for any third-party poster provider.
- Improve auth/sync status feedback, such as `Saved`, `Saving`, and `Offline`.
- Add more detail-sheet polish for poster and table interactions.

## Development Notes

- The visible deploy badge is defined in `app/page.tsx` as `appVersion`.
- Local tracking key: `g-list-lite-tracking-v1`.
- `To Watch` is a UI label for the stored status value `Up Next`, preserving existing local and Supabase data.
- The `lang` field is saved in tracking data. If the Supabase table has not yet been migrated, cloud sync falls back without `lang` until `supabase/schema.sql` is applied.
- Row notes are part of tracking data and can sync through Supabase. The standalone Notes view notepad uses local browser storage under `g-list-lite-notepad-v1` and can sync through Supabase table `lite_notepad` after `supabase/schema.sql` is applied.
- Desktop table column widths key: `g-list-lite-column-widths-v2`.
- Compact/mobile column widths key: `g-list-lite-compact-column-widths-v1`.
- Poster size key: `g-list-lite-poster-size-v1`.
- JSON import/export is kept as a backup and migration path even with cloud sync.
- On Windows/OneDrive, the dev server can lock `.next` or `out`; stop the dev server before production builds if `EPERM` appears.
- See `CODEX_SESSION_LOG.md` for implementation history and handoff notes.
