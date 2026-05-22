# G-LIST

G-LIST is the simplified tracker version of G-List. It should live as a completely separate project/repo from the full G-List app. The full app remains preserved in the original `G-List` repo.

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
     - `Up Next`
   - Watched year should be enabled only when status is `Watched`.
   - Previous saved `Skipped` values should migrate to `Up Next`.
   - Store tracking locally at first using `localStorage`.
   - Keep the tracking state small and cloud-ready:

```ts
type LiteTrackingEntry = {
  titleId: string;
  status: "Unwatched" | "Watching" | "Watched" | "Up Next";
  watchedYear?: string;
  notes?: string;
};
```

5. Search and basic filters
   - Search titles.
   - Status filtering dropdown was intentionally removed from the top controls.
   - Use the `Watch status` table header sort to group statuses in table view.
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
scripts/sync-gundam-wikipedia-lite.ts
```

That script captures the table data, title links when available, summaries, and thumbnails.

There is also a validation script:

```text
scripts/validate-wikipedia-snapshot.ts
```

It independently expands the live Wikipedia table into rows, including rowspans, and compares the four visible table columns against `data/g-list-lite-media.json`.

Run this whenever the sync parser changes:

```text
npm run sync:wikipedia
npm run validate:wikipedia
```

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
   - `G-LIST`
   - Table / Poster Wall segmented control
   - Search input on the far right edge

2. Table
   - Compact, Wikipedia-like dark table.
   - Match Wikipedia dark-mode styling closely:
     - Sans-serif text at about 16px.
     - Dark table background and thin gray borders.
     - Blue title links.
     - Italic/slanted title names in the `Name` column.
     - Sort indicators: double arrows by default, single ascending/descending arrow after click.
     - Sort cycle should be `default -> ascending -> descending -> default`.
     - Returning to default restores the original Wikipedia snapshot row order.
   - Blue title links.
   - Thin borders.
   - Sort arrows on active header.
   - Watch status select in the row.
   - Watched year input/select at the end of the row.
   - Table columns should be driven by a column definition object, not `nth-child` CSS:
     - `key`
     - `label`
     - `width`
     - `className`
     - optional `spanKey`
     - `render`
   - Preserve Wikipedia rowspans visually. Examples:
     - `Mobile Suit Gundam GQuuuuuuX` should show two media rows: `Compilation movie` and `TV series: 12 episodes`.
     - Its `Name`, `Release date`, and `Timeline and year` cells should span those rows like Wikipedia.
     - `Mobile Suit Gundam: The Witch from Mercury` should show `Prologue ONA` and `TV series: 24 episodes` as separate rows under one title.
   - Current preferred widths:
     - `Name`: about `44ch`, so `Mobile Suit Gundam MS IGLOO: Apocalypse 0079` fits before wrapping.
     - `Timeline and year`: about `31ch`, so `Advanced Generation (AG) 115-164` fits before wrapping.
     - Tracking columns must have dedicated width so `Watch status` and `Year` do not get squeezed.
     - The final tracking header should be `Year`, not `Watched year`.
   - The top control/header row should use the same computed width as the table.
   - Do not add a top status filter beside `Poster Wall`; status grouping should happen through table sorting.
   - Desktop table columns are manually resizable by dragging the right edge of each header.
   - Resized column widths persist to `localStorage` under `g-list-lite-column-widths-v1`.
   - Column resizing is implemented through the table column config and `colgroup`, so future layout changes should keep using that path.
   - Future desktop enhancement: add a visible `Reset columns` control if widths get awkward.
   - Future wide-table enhancement: add a top horizontal scrollbar or sticky scroll proxy so users do not have to scroll to the bottom to move horizontally.

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

- Desktop should keep the Wikipedia-style table as the primary view.
- Tablet can still offer the table with horizontal scroll, but the Poster Wall should become the nicer/default view.
- Phone should not use the full table as the primary experience. Use compact list/card rows instead.
- On phone, each item should show title, media, release date, timeline/year, watch status, and watched year control.
- Tap a card/title to open a preview sheet because hover does not exist reliably on touch.
- Preview sheet has an `Open Wikipedia` link.
- Tracking controls remain directly usable on the card or sheet.

## Current Implementation Notes

- This repo is a standalone Next app, separate from the original full `G-List` repo.
- Dev server may need to run on `http://127.0.0.1:3001` because the original full app often occupies port `3000`.
- `scripts/sync-gundam-wikipedia-lite.ts` pulls the Wikipedia `TV series, films, and video` table.
- The sync parser must respect Wikipedia `rowspan` values. Do not infer a new title only from the presence of a link, because some valid title rows are plain text.
- The sync parser must carry rowspanned values across continuation rows for `Name`, `Release date`, and `Timeline and year`.
- Do not skip one-cell continuation rows. `Mobile Suit Gundam GQuuuuuuX` has a continuation row containing only `TV series: 12 episodes`; release date and timeline are carried by rowspans.
- Plain-text title rows should render as plain text, not fake links back to the Gundam article.
- The local data snapshot currently lives at `data/g-list-lite-media.json` and currently contains 94 rows from the Wikipedia table.
- `npm run validate:wikipedia` currently confirms:
  - Wikipedia rows: `94`
  - Snapshot rows: `94`
  - Snapshot matches the live Wikipedia media table.
- The table currently renders from a column config in `app/page.tsx`; keep using that pattern before adding resizing.
- The table renderer uses `spanKey` values to visually merge consecutive repeated cells and mimic Wikipedia rowspans.
- Status tracking is stored in `localStorage` under `g-list-lite-tracking-v1`.
- Column widths are stored in `localStorage` under `g-list-lite-column-widths-v1`.
- Local state saves are gated until after localStorage has been loaded, so the first render does not wipe saved tracking or column widths.
- Known checks:

```text
npm run sync:wikipedia
npm run validate:wikipedia
npm run lint
npm run build
```

## Upgradeability Notes

- The current layout is intentionally upgradeable.
- Table columns are centralized in `app/page.tsx` as config, so future changes can alter labels, widths, renderers, sorting, visibility, and row-spanning behavior without rewriting every row.
- Draggable desktop column resizing already builds on that config:
  - Columns define `defaultWidth`, `minWidth`, and optional `maxWidth`.
  - Resized widths are stored in `localStorage`.
  - Widths are applied through the existing `colgroup`.
  - Sorting uses the header button; resizing uses a separate header-edge handle so sort clicks and resize drags do not conflict.
- Future layout changes should not require changing the Wikipedia sync format unless the data shape itself changes.
- Keep the snapshot shape small and cloud-ready; add UI-only behavior in component state or local preferences rather than bloating `LiteMediaEntry`.
- If adding phone/tablet layouts, keep the same data and tracking APIs:
  - Desktop table can stay Wikipedia-like.
  - Tablet can choose poster wall or horizontal table.
  - Phone can use compact cards/list rows.
- Before changing parser behavior, run `npm run validate:wikipedia`. Before changing table rendering, spot-check multi-row titles:
  - `Mobile Suit Gundam GQuuuuuuX`
  - `Mobile Suit Gundam: The Witch from Mercury`
  - `Mobile Suit Gundam SEED Freedom Zero`

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

## Completed First Implementation Task

The first implementation task has been completed.

Completed:

1. Created a standalone Next app for `G-LIST-Lite`.
2. Added `scripts/sync-gundam-wikipedia-lite.ts`.
3. Preserved table rows and title links from the Wikipedia section.
4. Fetches summaries/thumbnails for linked pages through MediaWiki APIs.
5. Saves to `data/g-list-lite-media.json`.
6. Built the first desktop table view from that snapshot.

Recommended next steps:

1. Add a visible `Reset columns` control for resized table widths.
2. Add a top horizontal scrollbar/sticky scroll proxy for wide table use.
3. Build tablet and phone layouts:
   - Tablet: poster wall as a strong/default option, table still available with horizontal scroll.
   - Phone: compact list/card layout instead of full table.
4. Add export/import JSON backup for local tracking.
