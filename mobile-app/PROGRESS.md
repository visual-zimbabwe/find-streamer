## Current Phase
Responsive Design & Fluid Sizing — Adapting UI elements to scale consistently across all device screen sizes.

## Completed Tasks
- [x] **Responsive Foundation:** Created `src/utils/responsive.js` offering dynamic calculations (`scale`, `verticalScale`, `scaleFont`) based on screen width/height ratios and pixel density.
- [x] **Theme Modernization:** Updated `theme/tokens.js` to define fluid spacings, radii, and typography using the new responsive utilities instead of rigid numbers.
- [x] **Component Adaptability:** Refactored fixed dimensions in `ResultView`, `WatchlistView`, and `SkeletonLoaders` to utilize percentage-based layouts or `scale`/`verticalScale`, preventing stretching on large devices and clipping on small phones.
- [x] **Safe Area Verification:** Ensured `SafeAreaView` from `react-native-safe-area-context` is consistently acting as the root layout provider in `App.js` to handle device notches and bezels.
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

- [x] **Starring Actor Discovery** — Full implementation:
  - `src/lib/tmdb.js` — `getCredits()` now returns `starringPersons: [{id, name}]` (top 5 cast), alongside the existing `starring` string.
  - `src/lib/tmdb.js` — `fetchPersonFilmography(personId, personName, role)` now accepts `role='cast'` (in addition to `'movie'` / `'tv'`). For actors it hits `/person/{id}/combined_credits` → `cast` array (deduplicated, filtered to `vote_count >= 5`, sorted newest-first). Returns mixed movie+TV results each with their own `mediaType` and `character` field.
  - `src/components/ResultView.js` — STARRING section now renders each actor as a tappable underlined link (same pattern as director/created-by). Fires `onPersonPress(id, name, 'cast')`.
  - `src/components/FilmographyScreen.js` — Rewritten to accept `role` prop (`'cast'` | `'movie'` | `'tv'`). For `'cast'`: header shows ⭐ icon + "STARRING IN" label; each card shows a small film/TV icon badge in top-left; subtitle shows `year · Character Name`. keyExtractor uses `mediaType-tmdbId` to avoid collisions in mixed results.
  - `App.js` — `filmographyPerson` state stores `role` instead of `mediaType`. `FilmographyScreen` receives `role` prop.

- [x] **Navigation Fix** — Resolved back-navigation loops (e.g. Movie → Director → Movie) by implementing a full `navigationHistory` stack in `App.js`. This replaces manual `origin` tracking with state-preserving snapshots for every navigation step.
- [x] **Hardware Back Support** — Updated Android hardware back button handler to correctly pop from the navigation stack before allowing the app to close.
- [x] **Discover Filter Evolution** — Language Presets:
  - `src/lib/languagePresets.js` — Created a curated mapping layer for regional language groups (Europe, East Asia, etc.) and special toggles (Exclude English). Includes "smart filter" metadata for imperfect mappings (Middle East, Africa, Latin America).
  - `src/lib/tmdb.js` — Updated `discoverTitles` to handle `excludeEnglish` by fetching all languages and including all codes except 'en'.
  - `src/lib/discoverViewModel.js` — Added `activePreset`, `excludeEnglish` state; implemented `applyPreset` / `clearPreset` actions.
  - `src/components/DiscoverScreen.js` — Added "Language Presets" scrollable chip section; integrated info banners for region descriptions and smart-filter warnings; synced presets with the advanced language picker.

- [x] **Watchlist Experience & Organization**:
  - `src/components/WatchlistView.js` — Implemented automatic sub-grouping within each category: items are now split into "Movies" and "TV Shows" blocks.
  - Added rating-based sorting: each sub-group is ordered by rating in descending order.
  - Enhanced UI hierarchy: added sub-group headers with icons (`film-outline`, `tv-outline`) and dividers.
  - Fixed category header count to reflect the `totalCount` of all items in sub-groups.

- [x] **Person Search Fallback** — Enhanced cast/crew interactivity:
  - `src/lib/tmdb.js` — Added `searchPersonByName(name)` to allow finding TMDB IDs for persons when only a name string is available (e.g. from OMDb data).
  - `src/components/ResultView.js` — Cast and crew members without a TMDB ID are now tappable. Clicking one triggers a fallback search to find their ID before navigating to their filmography.
  - Added visual haptic feedback and user-friendly alerts when a person cannot be found or the search fails.

## Active Bugs
- None.

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
- **Language Presets:** Uses a dedicated `languagePresets.js` mapping layer instead of raw ISO codes. "Exclude English" is simulated by including all non-English languages in `with_original_language` since TMDB lacks a `without_original_language` parameter.
- **Smart Filters:** Labeled with ✨ icons and explanatory text when TMDB's language/genre data is imprecise (e.g., Arabic, Sub-Saharan Africa, Latin America).
- **Person Search Fallback:** Uses `/3/search/person` with a single result limit to resolve IDs for name-only actor/crew strings, bridging the gap between OMDb-sourced cast lists and TMDB filmography data.
- **Worklet Dependency:** Re-added `react-native-worklets` as a required peer dependency since the application uses `react-native-reanimated` v4.2.1, which delegates worklet multithreading to the standalone `react-native-worklets` library.

- **Session History:**
- **2026-03-24:** Resolved EAS permission error by removing the old `projectId` from `app.json` and re-initializing the project. Successfully started the Android build.
- **2026-04-21 (session 1):** Implemented full Discover/Filter feature (3 new files, 3 modified files).
- **2026-04-21 (session 2):** Upgraded Discover screen to full spec: searchable language/country pickers from TMDB API, Origin Country (TV-only), media-type-aware sort options, fixed BottomNav clipping, vote_count.gte=20.
- **2026-05-02 (session 1):** Added director/creator tappable links (FilmographyScreen) for movies and TV shows.
- **2026-05-02 (session 2):** Extended to starring actors — all 5 top-billed cast members are tappable; clicking one shows their full filmography (movies + TV shows combined) via TMDB combined_credits API.
- **2026-05-06:** Implemented Watchlist sub-grouping (Movies vs TV) and rating-based sorting. Added visual dividers and group headers to the Watchlist view.
- **2026-05-12:** Implemented person-search fallback for cast members without a TMDB ID. Users can now open filmographies for name-only actor strings by performing an automatic background search.
- **2026-05-17:** Resolved Android EAS bundling failure (`Cannot find module 'react-native-worklets/plugin'`) by installing `react-native-worklets` via `npx expo install`, aligning it with Reanimated v4.2.1's peer dependency requirements, and verified successful bundling.
