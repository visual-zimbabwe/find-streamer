## Current Phase
Discover / Filter Feature — complete and wired into navigation.

## Completed Tasks
- [x] Initialized project link with `eas project:init` after removing defunct `projectId`.
- [x] Fixed "Entity not authorized" error in EAS CLI by re-authenticating and re-linking.
- [x] Initiated Android preview build (`eas build --platform android --profile preview`).
- [x] Configured Android package name `kkadogo.findstreamer.com`.
- [x] **Discover Feature** — Full end-to-end implementation:
  - `src/lib/tmdb.js` — Added `fetchGenres(mediaType)` (with in-memory cache) and `discoverTitles(filters)` (dynamic query builder for `/3/discover/movie|tv`, pagination, all filter params).
  - `src/lib/discoverViewModel.js` — New ViewModel hook: manages filter state, genre loading, paginated search, load-more, year-range validation, stale-response guard.
  - `src/components/DiscoverScreen.js` — Full filter UI: content-type toggle, genre chips (AND/OR), rating step selector, language chips (horizontal scroll), year range inputs, sort-by chips, results count, 2-col poster grid, load-more button, empty/error/loading states.
  - `src/components/BottomNav.js` — Added "Discover" tab (3rd tab, `options-outline` icon).
  - `App.js` — Wired `discover` view/tab, `handleSelectDiscoverItem` handler, `detailOrigin` state for correct back-navigation from detail → discover.

## Active Bugs
- None known.

## Technical Decisions
- **Profile:** Use `preview` in `eas.json` to generate installable APKs for direct testing.
- **Project Link:** Re-linked to `juwimana` EAS account to resolve permission issues.
- **Genre Cache:** In-memory (module-level `_genreCache` object in `tmdb.js`) — simple, avoids Room DB dependency.
- **Genre Logic:** AND = comma-separated IDs, OR = pipe-separated IDs (TMDB convention).
- **DiscoverScreen loading:** Does NOT block the global `loading` spinner — uses its own internal state so the filter form stays visible while results load.
- **Back Navigation:** `detailOrigin` state tracks where detail was launched from (`results` | `watchlist` | `discover`) so Back returns to the correct screen.

## Session History
- **2026-03-24:** Resolved EAS permission error by removing the old `projectId` from `app.json` and re-initializing the project. Successfully started the Android build.
- **2026-04-21:** Implemented full Discover/Filter feature (3 new files, 3 modified files).
