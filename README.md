# G-LIST Lite

G-LIST Lite is the simplified tracker version of G-List. It should live as a completely separate project/repo from the full G-List app. The full app remains preserved in the original `G-List` repo.

This file is the handoff brief for future Codex sessions. If the chat/session is lost, start here.

## Goal

Build a clean, fast, desktop-first Gundam media tracker that feels like the Wikipedia table in dark mode, with one extra tracking layer for personal watch status.

Primary inspiration:

- Wikipedia page: `https://en.wikipedia.org/wiki/Gundam`
- Section: `TV series, films, and video`
- Visual style: dark background, simple table, blue links, compact rows, readable typography
- Behavior: sortable table columns, title links, preview card on hover

## Must-Have Features

1. Table view
   - Columns:
     - Name
     - Media
     - Release date
     - Timeline and year
     - Watch status
     - Watched year
   - Clicking a column header sorts that column.
   - Name should link to the source page for that title.

2. Poster wall view
   - Toggle between `Table` and `Poster Wall`.
   - Poster cards use available Wikipedia thumbnail/poster images.
   - Cards show title, media type, release date, and watch status.

3. Preview behavior
   - Desktop: hover over a title or poster to show a compact preview card.
   - Preview should include:
     - Title
     - Thumbnail/poster if available
     - Short Wikipedia summary
     - Media
     - Release date
     - Timeline/year
     - Watch status/year
   - Mobile/tablet later: tap opens a preview sheet/card because hover does not exist reliably on touch.

4. Personal tracking
   - Status options:
     - `Unwatched`
     - `Watching`
     - `Watched`
     - `Skipped`
   - Watched year should be enabled only when status is `Watched`.
   - Store tracking locally at first using `localStorage`.
   - Keep the tracking state small and cloud-ready:

```ts
type LiteTrackingEntry = {
  titleId: string;
  status: "Unwatched" | "Watching" | "Watched" | "Skipped";
  watchedYear?: string;
  notes?: string;
};
```

5. Search and basic filters
   - Search titles.
   - Filter by status.
   - Optional later: filter by media type or timeline.

## Nice-To-Have Later

- Export/import JSON backup.
- Cloud sync and login.
- iPad/mobile-optimized layout.
- Local detail drawer before opening Wikipedia.
- Favorites or notes, only if Lite still feels simple.

## Avoid For Lite

Do not bring over the full app complexity unless specifically needed:

- Watch paths
- Related-title scoring
- Large stats dashboard
- Multiple themes
- Complex queue recommendations
- Full metadata editing
- Big detail panels

Lite should feel like a tracker notebook, not a command center.

## Data Strategy

Do not paste Wikipedia HTML unless the API blocks us.

Preferred approach:

1. Extend or add a sync script that uses the MediaWiki API.
2. Pull the `TV series, films, and video` table entries.
3. For each title, also capture:
   - source page URL
   - page title
   - page id if available
   - short extract/summary
   - thumbnail/poster URL if available
4. Save a local snapshot under `data/`, for example:

```text
data/g-list-lite-media.json
```

Potential entry shape:

```ts
type LiteMediaEntry = {
  id: string;
  name: string;
  media: string;
  releaseDate: string;
  timelineAndYear: string;
  sourceUrl: string;
  pageTitle?: string;
  pageId?: number;
  extract?: string;
  thumbnailUrl?: string;
};
```

The current repo already has a Wikipedia sync script:

```text
scripts/sync-gundam-wikipedia.ts
```

That script currently captures the table data but not title links, summaries, or thumbnails. Use it as the starting point.

## Proposed File Layout

Build Lite as its own Next app:

```text
app/page.tsx
app/lite-data.ts
app/lite-types.ts
app/lite-helpers.ts
app/lite-storage.ts
app/globals.css
data/g-list-lite-media.json
scripts/sync-gundam-wikipedia-lite.ts
```

Recommended separate project folder:

```text
G-LIST-Lite/
```

Keep Lite components small and boring. Prefer inline row editing over modals for the first version.

## Desktop-First UI Plan

1. Top bar
   - `G-LIST Lite`
   - Search input
   - Table / Poster Wall segmented control
   - Status filter

2. Table
   - Compact, Wikipedia-like dark table.
   - Blue title links.
   - Thin borders.
   - Sort arrows on active header.
   - Watch status select in the row.
   - Watched year input/select at the end of the row.

3. Poster wall
   - Responsive grid.
   - Poster image, title, and compact metadata.
   - Same tracking controls as table, but visually quieter.

4. Preview card
   - Position near hovered item on desktop.
   - Keep it small.
   - It should not block the row being hovered.

## Mobile Plan

Do this after desktop works.

- Table can become horizontally scrollable first.
- Poster wall should become the primary mobile view.
- Tap a card/title to open a preview sheet.
- Preview sheet has an `Open Wikipedia` link.
- Tracking controls remain directly usable on the card or sheet.

## Persistence Plan

Phase 1:

- Use `localStorage`.
- Key suggestion:

```text
g-list-lite-tracking-v1
```

Phase 2:

- Add export/import JSON.

Phase 3:

- Deploy online.
- Add cloud persistence.
- Recommended options:
  - Simple private key + database for personal use
  - Supabase auth/database if real accounts are desired

Important: keep the local tracking shape similar to the future database row shape so migration is easy.

## Current Repo State

Useful commits:

```text
1c4e83c Add helper tests
325c2d1 Expand tracker features and fix project tooling
```

Original full G-List known-good checks:

```text
npm test
npm run lint
npm run build
npm audit --audit-level=moderate
```

The full app is already committed in the original `G-List` repo and should stay separate.

## First Implementation Task

Start by creating the Lite data snapshot.

Recommended next steps:

1. Create a new standalone Next app for `G-LIST-Lite`.
2. Add a new sync script, likely `scripts/sync-gundam-wikipedia-lite.ts`.
3. Preserve table rows and title links from the Wikipedia section.
4. Fetch summaries/thumbnails for linked pages through MediaWiki APIs.
5. Save to `data/g-list-lite-media.json`.
6. Build the first desktop table view from that snapshot.
