# G-LIST Lite

G-LIST Lite is a compact Gundam media tracker built around the `TV series, films, and video` table from Wikipedia's Gundam page. It keeps the table-first feel of Wikipedia, adds personal watch tracking, and can sync watch data online with Supabase.

Live site:

```text
https://glist.francocongiusto.com
```

## Features

- Sortable dark-mode media table.
- Wikipedia-style row grouping for titles with multiple media rows.
- Poster wall view with responsive poster sizing.
- Notes view for per-title notes.
- Hover previews on desktop and preview sheet behavior for touch/mobile.
- Watch tracking statuses:
  - `Unwatched`
  - `Watching`
  - `Watched`
  - `Up Next`
- Watched year field for watched titles.
- Import/export JSON backup.
- Local cache with `localStorage`.
- Optional cloud sync with Supabase email/password Auth and Supabase Postgres.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- CSS Modules-style global CSS in `app/globals.css`
- Supabase Auth and Postgres for cloud persistence
- MediaWiki/Wikipedia data sync scripts
- Cheerio for snapshot parsing/validation
- ESLint 9
- Static export deployment with `next.config.mjs` using `output: "export"`

## Project Structure

```text
app/
  page.tsx                 Main UI
  globals.css              App styling
  lite-cloud-storage.ts    Supabase auth/sync helpers
  lite-helpers.ts          Filtering, sorting, tracking helpers
  lite-storage.ts          localStorage fallback/cache
  lite-types.ts            Shared TypeScript types
data/
  g-list-lite-media.json   Wikipedia media snapshot
scripts/
  sync-gundam-wikipedia-lite.ts
  validate-wikipedia-snapshot.ts
supabase/
  schema.sql               Cloud tracking table and RLS policies
public/
  .htaccess                Static hosting rewrite/MIME safeguard
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open:

```text
http://127.0.0.1:3001
```

Port `3001` is commonly used locally because the full G-List app may occupy port `3000`.

## Environment Variables

Cloud sync is optional. Without Supabase env vars, the app still runs with local-only tracking.

Create `.env.local` for local Supabase sync:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Do not commit `.env.local`.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Add these Auth redirect URLs in Supabase:

```text
http://127.0.0.1:3001
https://glist.francocongiusto.com
```

4. Add the same env vars to Hostinger before deploying cloud sync.

The Supabase table stores only personal tracking data:

- user id
- title id
- watch status
- watched year
- notes
- updated timestamp

Poster/thumbnail metadata stays in the public Wikipedia snapshot and is not stored per user.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run sync:wikipedia
npm run validate:wikipedia
```

## OneNote / Spreadsheet Export

Static spreadsheet exports are available under `exports/`:

```text
exports/g-list-lite-onenote.csv
exports/g-list-lite-onenote.tsv
```

Use the CSV for Excel. Use the TSV if you want to paste rows into a OneNote page as a native table.

OneNote can sort table data, but Excel is still the better option for heavier spreadsheet behavior. In OneNote for Microsoft 365/desktop, tables can also be converted to Excel spreadsheets.

Use the Wikipedia sync and validation scripts when changing parser behavior:

```bash
npm run sync:wikipedia
npm run validate:wikipedia
```

Known validation targets include multi-row titles such as:

- `Mobile Suit Gundam GQuuuuuuX`
- `Mobile Suit Gundam: The Witch from Mercury`
- `Mobile Suit Gundam SEED Freedom Zero`

## Deployment

The app is currently configured for static export:

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

The generated `out/` directory should include:

- `index.html`
- `_next/static/...`
- `.htaccess`

The `.htaccess` file comes from `public/.htaccess` and helps Hostinger serve static CSS/JS assets correctly instead of rewriting asset requests to `index.html`.

## Development Notes

- The visible deploy badge is defined in `app/page.tsx` as `appVersion`.
- Local tracking key: `g-list-lite-tracking-v1`.
- Desktop table column widths key: `g-list-lite-column-widths-v1`.
- Compact/mobile column widths key: `g-list-lite-compact-column-widths-v1`.
- Poster size key: `g-list-lite-poster-size-v1`.
- JSON import/export is intentionally kept as a backup even with cloud sync.
- See `CODEX_SESSION_LOG.md` for implementation history, current context, and next-step notes for future Codex sessions.
