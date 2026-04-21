## Current Phase
Discover / Filter Feature — fully spec-compliant. All filters wired. BottomNav clipping fixed.

## Completed Tasks
- [x] Initialized project link with `eas project:init` after removing defunct `projectId`.
- [x] Fixed "Entity not authorized" error in EAS CLI by re-authenticating and re-linking.
- [x] Initiated Android preview build (`eas build --platform android --profile preview`).
- [x] Configured Android package name `kkadogo.findstreamer.com`.
- [x] **Discover Feature** — Full end-to-end implementation:
  - `src/lib/tmdb.js` — Added `fetchGenres(mediaType)` (with in-memory cache), `fetchLanguages()`, `fetchDiscoverCountries()` (both with in-memory caches, full TMDB lists), and `discoverTitles(filters)` (dynamic query builder for `/3/discover/movie|tv`, pagination, all filter params, `vote_count.gte=20`, `with_origin_country` for TV).
  - `src/lib/discoverViewModel.js` — ViewModel hook: manages filter state (incl. `originCountry`), genre/language/country loading, paginated search, load-more, year-range validation, stale-response guard.
  - `src/components/DiscoverScreen.js` — Full filter UI: content-type toggle, genre chips (AND/OR), rating step selector, **searchable language picker modal** (150+ languages from TMDB API), **Origin Country picker modal (TV-only, 200+ countries)**, year range inputs, media-type-aware sort-by chips (Revenue hidden for TV, date field switched for TV), results count, 2-col poster grid, load-more button, empty/error/loading states.
  - `src/components/BottomNav.js` — Added "Discover" tab (3rd tab, `options-outline` icon). **Fixed icon/label clipping** by removing fixed `height:80` and using `paddingTop:10` + `paddingBottom: insets.bottom + 8`.
  - `App.js` — Wired `discover` view/tab, `handleSelectDiscoverItem` handler, `detailOrigin` state for correct back-navigation from detail → discover.

- [x] **EAS Build Fix** — Resolved "Install dependencies" failure by aligning project dependencies with Expo SDK 55 (updated React 19, RN 0.83, etc.) and adding `.npmrc` for `legacy-peer-deps`.

## Active Bugs
- None (pending live device verification of genre reset on media type switch).

## Technical Decisions
- **Profile:** Use `preview` in `eas.json` to generate installable APKs for direct testing.
- **Project Link:** Re-linked to `juwimana` EAS account to resolve permission issues.
- **Dependency Alignment:** Updated React and React Native versions to match Expo SDK 55 requirements using `npx expo install --fix`.
- **NPM Configuration:** Added `.npmrc` with `legacy-peer-deps=true` to ensure stable installs on EAS despite minor peer dependency conflicts during the SDK 55 transition.
- **Genre Cache:** In-memory (module-level `_genreCache` object in `tmdb.js`) — simple, avoids Room DB dependency.
- **Genre Logic:** AND = comma-separated IDs, OR = pipe-separated IDs (TMDB convention).
- **DiscoverScreen loading:** Does NOT block the global `loading` spinner — uses its own internal state so the filter form stays visible while results load.
- **Back Navigation:** `detailOrigin` state tracks where detail was launched from (`results` | `watchlist` | `discover`) so Back returns to the correct screen.
- **Language Picker:** Searchable bottom-sheet modal backed by full TMDB `/3/configuration/languages` list — in-memory cached, pre-fetched on screen mount.
- **Country Picker:** Same pattern for `/3/configuration/countries`, shown only when TV is selected → maps to `with_origin_country`.
- **BottomNav fix:** Removed hard-coded `height:80`, added explicit `paddingTop:10`. Safe-area `insets.bottom` already applied correctly.
- **vote_count.gte:** Changed from 50 → 20 per spec.
- **Sort options:** Media-type aware — Revenue hidden for TV; date sort params switch between `primary_release_date.*` (movies) and `first_air_date.*` (TV).

## Session History
- **2026-03-24:** Resolved EAS permission error by removing the old `projectId` from `app.json` and re-initializing the project. Successfully started the Android build.
- **2026-04-21 (session 1):** Implemented full Discover/Filter feature (3 new files, 3 modified files).
- **2026-04-21 (session 2):** Upgraded Discover screen to full spec: searchable language/country pickers from TMDB API, Origin Country (TV-only), media-type-aware sort options, fixed BottomNav clipping, vote_count.gte=20.
