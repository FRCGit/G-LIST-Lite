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
   - Export/import JSON backup should be available from the top controls.
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

Backup shape:

```ts
type LiteTrackingBackup = {
  version: 1;
  exportedAt: string;
  tracking: Record<string, LiteTrackingEntry>;
};
```

5. Search and basic filters
   - Search titles.
   - Status filtering dropdown was intentionally removed from the top controls.
   - Use the `Watch status` table header sort to group statuses in table view.
   - Optional later: filter by media type or timeline.

## Nice-To-Have Later

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
   - Watch status selects should use the same neutral border color for all statuses.
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
   - Compact/mobile table widths use a separate profile under `g-list-lite-compact-column-widths-v1`.
   - Compact/mobile table should start from each column's `minWidth`, but still allow resizing.
   - Resizing/resetting columns on mobile must not overwrite desktop column widths.
   - Column resizing is implemented through the table column config and `colgroup`, so future layout changes should keep using that path.
   - Show a `Reset columns` control in table view when custom column widths are saved.
   - `Reset columns` should clear `g-list-lite-column-widths-v1` and restore default widths.
   - Table view should include a top horizontal scrollbar synced with the table body so users do not have to scroll to the bottom to move horizontally.
   - Hide the table body's bottom horizontal scrollbar; horizontal table movement should happen from the top synced scrollbar only.

3. Poster wall
   - Plex-inspired responsive poster grid.
   - Design reference saved at `design/poster-wall-plex-reference.png`.
   - Poster controls should follow the Plex-style toolbar reference:
     - `View` icon group with poster/grid and table/list buttons.
     - `Poster Size` slider with current size text.
     - `Sort by` dropdown.
     - `Filter` button and overflow menu affordance for future filtering/actions.
     - Use the screenshot-style framed shell, thin top accent line, rounded dark toolbar, and left vertical icon rail.
     - Header title and toolbar should be left-stacked from the same left edge; do not use a full-width divider under the title.
     - The title, toolbar, count, and table/poster content should be centered together as one inner content block while keeping their shared left edge aligned.
     - Use the same subtle rounded corner radius across the shell, toolbar controls, search/import/export buttons, status/year inputs, poster cards, and table outer frame.
     - Treat the rail and content as one unified rounded outer frame. The rail is an internal column with a divider, not a separate bordered box.
     - View group should only have two active icons for now: poster/grid and table/list.
     - Left rail icons currently represent Table, Poster Wall, and Notes only.
     - Notes view lists titles A-Z and saves per-title notes into the existing tracking localStorage object.
   - Keep the toolbar accent blue for now to match the existing G-LIST link color, even though the Plex reference uses orange.
   - Poster size uses a slider instead of named density buttons.
   - Poster size persists in `localStorage` under `g-list-lite-poster-size-v1`.
   - Old `g-list-lite-poster-density-v1` values are only used as migration fallback.
   - Poster frame, title, and compact metadata.
   - Temporarily hide poster art in Poster Wall until final visual pass; keep the frame size/aspect ratio stable.
   - Hover preview cards may still use thumbnails/posters.
   - On mobile, keep the desktop slider label/control but bucket the poster wall into three visual sizes:
     - Small: two-up poster cards, still with poster frames.
     - Medium: centered larger poster cards.
     - Large: single-column poster cards using the full available width.
   - Do not bring back the no-poster/dense-list smallest mode unless explicitly requested.
   - Same tracking controls as table, but visually quieter.
   - Do not show disabled `Year` inputs on every poster card.
   - In poster view, show the year input only when status is `Watched`; otherwise the status select should use the full control width.
   - When a poster card is `Watched`, keep status and year side-by-side, but tighten control padding so `Watched` does not get clipped in narrow cards.
   - Keep poster controls compact enough that they do not overflow narrow cards.

4. Preview card
   - Position near hovered item on desktop.
   - Keep it small.
   - It should not block the row being hovered.

## Mobile Plan

- Desktop should keep the Wikipedia-style table as the primary view.
- Tablet can still offer the table with horizontal scroll, but the Poster Wall should become the nicer/default view.
- Phone should not use the full table as the primary experience. Poster Wall becomes responsive poster cards with mobile-only Small/Medium/Large sizing through the existing poster-size slider.
- On phone, each item should show title, media, release date, timeline/year, watch status, and watched year control.
- Tap a card/title to open a preview sheet because hover does not exist reliably on touch.
- Preview sheet has an `Open Wikipedia` link.
- Tracking controls remain directly usable on the card or sheet.
  - Current responsive behavior:
    - Header width is allowed to become fluid on phone instead of using desktop table width.
    - Table remains horizontally scrollable.
    - Mobile/tablet table horizontal drag uses custom kinetic scrolling on the table body so a swipe can keep coasting after release, similar to desktop Chrome. Native form controls, links, and resize handles should not start table drag.
    - Touch devices, including iPad Safari, use the draggable table overflow behavior even when the viewport is wider than the phone breakpoint.
    - Poster Wall uses mobile-only size buckets on phone: two-up small cards, centered medium cards, or full-width large cards.
  - Hover preview card is hidden on phone because hover is not reliable.
  - Tap/click can open a preview sheet with summary, metadata, status, and an `Open Wikipedia` link.

## Current Implementation Notes

- This repo is a standalone Next app, separate from the original full `G-List` repo.
- Dev server may need to run on `http://127.0.0.1:3001` because the original full app often occupies port `3000`.
- GitHub repo: `https://github.com/FRCGit/G-LIST-Lite`
- Important workflow preference: do not push unless explicitly asked.
- As of the latest session, local branch may be ahead of GitHub. Check with:

```text
git status --short --branch
```

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
- Compact/mobile column widths are stored separately under `g-list-lite-compact-column-widths-v1`.
- Poster Wall size is stored in `localStorage` under `g-list-lite-poster-size-v1`; the old density key is migration-only.
- Local state saves are gated until after localStorage has been loaded, so the first render does not wipe saved tracking or column widths.
- The deployed Hostinger/GitHub flow uses `main`; pushing to GitHub updates the live Hostinger deployment.
- Current live target is `glist.francocongiusto.com`.
- A small fixed version badge appears in the bottom-right corner so it is easy to confirm the live site has redeployed after a push.
- The app is currently static-exportable because it uses client state/localStorage and no server routes. `next.config.mjs` uses `output: "export"`, so Hostinger should publish the generated `out/` directory. This avoids missing CSS/assets from a misconfigured Node runtime.
- If Hostinger asks for build/output settings, use:
  - Install: `npm install`
  - Build: `npm run build`
  - Output directory: `out`
- Tracking can be exported/imported as JSON from the top controls.
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
  - Desktop resized widths are stored in `localStorage`.
  - Compact/mobile resized widths are stored separately so they do not affect desktop.
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

- Add cloud-ready persistence or a richer backup flow if needed.

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

1. Poster Wall direction:
   - Current target is the Plex-style library grid from `design/poster-wall-plex-reference.png`.
   - Poster Wall now uses a `Poster size` slider instead of `Small` / `Medium` / `Large`.
   - The slider is saved under `g-list-lite-poster-size-v1`.
   - Old saved density values migrate forward: old `Compact` / `Small` maps to a smaller slider value, old `Large` maps to a larger value.
   - On phone, keep the poster placeholder frame even at the small size; do not return to the no-poster dense row unless explicitly requested.
   - Deprecated no-poster mobile row shape:

```text
Mobile Suit Gundam
TV series: 43 episodes · 1979-1980
[Watched] [2019]
```

   - Current mobile poster sizes all keep the placeholder frame on phone.
2. Consider poster wall refinements:
   - Hide poster controls until hover on desktop, but keep them always visible on touch.
   - Add a small watched-year badge on watched poster cards.
   - Add a detail sheet so the poster card itself can stay cleaner.
