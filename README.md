# Trova — Premium Cinema & Streaming Discovery Companion

Trova (commercially branded version of **FindStreamer**) is a state-of-the-art, high-polish mobile application designed for movie and TV enthusiasts. It allows users to search globally for film/TV metadata, track localized streaming availability across major providers (Netflix, Amazon Prime Video, Max, CBC Gem in Canada, BBC iPlayer, Channel 4, and ITVX in the UK, and SBS On Demand plus ABC iview in Australia), organize personal watchlists, and discover new titles through smart recommendations.

Built on **React Native** and **Expo SDK 55**, Trova features a cinematic design system with dynamic color-adaptive backdrops, fluid glassmorphic navigations, layered gesture-driven bottom sheets, and native sharing tools.

---

## Key Features

### 🔍 1. Live Search & Title Resolution
* **Instant Auto-Suggestions**: Debounced search-as-you-type using TMDB's multi-search endpoints.
* **Unified Person Routing**: Automatically detects actor/director/creator queries and routes directly to their detailed filmography grids.
* **Deep Resolution**: Merges primary metadata from **TMDB** with detailed critic scores and localized plot summaries from **OMDb**.

### 🌍 2. Global Streaming Availability
* **Country-by-Country Matrix**: Resolves watch provider data to display exactly which countries host a title on **Netflix**, **Prime Video**, **Max**, Canada-only **CBC Gem**, UK-only **BBC iPlayer**, **Channel 4**, and **ITVX**, and Australia-only **SBS On Demand** and **ABC iview**.
* **Episode-Level Lookups**: Resolves TV show availability down to individual episodes using concurrent request limits to ensure precise global coverage despite season-level licensing variances.
* **Service Badging**: Pulls official brand logos directly from the API with vibrant color fallbacks based on brand identity.

### 🎛️ 3. Advanced Catalog Discovery
* **Multi-Filter Engine**: Filter titles by content type, year ranges, rating thresholds, sorting metrics, and origin countries.
* **Genre Logic**: Filter using strict intersection (`AND`) or union (`OR`) combinations.
* **Curated Language Presets**: Apply smart regional presets (e.g. East Asia, Europe, Latin America) alongside advanced custom selectors supporting over 150 languages.
* **Smart Content Excluding**: Exclude genres or custom categories (e.g., filter out Anime using Japanese animation heuristics).

### 🎲 4. Smart Surprise Engine
* **Seed-Based Recommendations**: Generates personal recommendations dynamically from titles saved in the user's "Highly Recommend" watchlist.
* **Genre Shuffles**: Shake up the feed with a random, high-rated shuffle in specific genres (e.g., horror, action, sci-fi).

### 📦 5. Interactive Watchlist & Backups
* **Smart Sorting & Grouping**: Automatically groups watchlists by media type (Movies vs. TV Shows) and sorts them by rating.
* **Custom Categorization**: Organize titles by custom tiers (Highly Recommend, Standard, Watched, etc.).
* **Data Portability**: Backup and restore the entire watchlist using local JSON import/export tools.

### 🎙️ 6. Hands-Free Voice Search
* **Local Speech Recognition**: Trigger voice searches through device microphone inputs using integrated voice-to-text models.

### 🖼️ 7. Native Sharing Cards
* **High-Fidelity Canvas**: Generate beautifully compiled sharing cards using off-screen native view-shot captures (`react-native-view-shot`).
* **Instant QR Code Sharing**: Embeds quick-scannable QR codes onto sharing cards.

---

## Project Structure

```text
find-streamer/
├── App.js                         # Root composition: assembles domain hooks → providers → navigation
├── AGENT.md                       # AI agent instruction guidelines
├── PROGRESS.md                    # Detailed log of project task completions
├── README.md                      # Comprehensive developer guide (This file)
├── REFACTOR_PLAN.md               # Phased refactor roadmap
├── app.json                       # Expo configuration manifest (Android-only)
├── package.json                   # Project scripts and node dependencies
├── tsconfig.json                  # TypeScript settings (JSDoc + // @ts-check, no .ts migration)
├── eslint.config.js               # ESLint flat config (eslint-config-expo, warnings-only)
├── .prettierrc                    # Prettier formatting rules
├── metro.config.js                # Metro bundler configuration
├── icon.png / icon-light.png      # App + adaptive launcher icons
├── android/                       # Native Android Gradle project (bare/prebuild workflow)
├── scripts/                       # Local maintenance scripts (icon sync, collection enrichment)
├── src/
│   ├── components/                # Modular React Native UI components
│   │   ├── AppHeader.js           # Navigation bar with contextual back buttons
│   │   ├── BottomNav.js           # Floating premium glassmorphic navigation bar capsule
│   │   ├── CollectionContentRail.js # Horizontal rail of collection titles
│   │   ├── CollectionFindSheet.js # Sheet to find/add titles to a collection
│   │   ├── CollectionsScreen.js   # Collections browser (incl. IMDb Top 100)
│   │   ├── DiscoverScreen.js      # Advanced discovery panel and search filters
│   │   ├── EmptyState.js          # Fallback screen for missing data/results
│   │   ├── ErrorBanner.js         # System error warnings
│   │   ├── FilmographyScreen.js   # Director/creator/actor filmography grid
│   │   ├── FranchiseRailsView.js  # Franchise/collection rails
│   │   ├── HomeScreen.js          # Feed carousels, categories, and quick previews
│   │   ├── HomeTopNav.js          # Home screen top navigation
│   │   ├── LaunchGate.js          # Gates first paint until launch intro completes
│   │   ├── LaunchIntro.js         # Animated launch/splash intro
│   │   ├── MatchResults.js        # Search result list and action rows
│   │   ├── MediaArtwork.js        # Color-adaptive backdrop viewer
│   │   ├── ProgressiveBlur.js     # Gradient-based cinematic blur overlays
│   │   ├── ResultView.js          # Parallax detail view with provider matrices
│   │   ├── SearchPanel.js         # Debounced search bar with live auto-suggestions
│   │   ├── SettingsView.js        # Theme picker, backup, API rate panels, credits
│   │   ├── ShareCard.js           # Social media card layout for view-shot canvas
│   │   ├── ShareOptionsSheet.js   # Custom share sheets
│   │   ├── SkeletonLoaders.js     # Fluid shimmer state placeholders
│   │   ├── SoundtrackPickerSheet.js # Soundtrack browser sheet (Wikidata/Spotify)
│   │   ├── StackBottomSheet.js    # Layered gesture-driven modal sheets
│   │   ├── StatePanel.js          # Retry panels for network/rate failures
│   │   ├── TrailerModal.js        # Floating trailer webview
│   │   ├── WatchlistCollectionsSheet.js # Collection assignment sheet
│   │   └── WatchlistView.js       # Watchlist manager with subgroup filters
│   │
│   ├── context/                   # React state contexts
│   │   ├── BottomNavVisibilityContext.js # Dynamic scroll-tracking hide/show listener
│   │   └── domainContexts.js      # Per-domain providers/hooks (search, watchlist, people, etc.)
│   │
│   ├── hooks/                     # Domain controller hooks (state + handlers)
│   │   ├── useAppNavigation.js    # Tab/route navigation + hardware back handling
│   │   ├── useDetailController.js # Selected result + recently-viewed state
│   │   ├── usePeopleController.js # Filmography / person / company routing
│   │   ├── useRequestError.js     # Error + offline-banner handling
│   │   ├── useSearchController.js # Live search, type-ahead, recent searches
│   │   ├── useSurpriseController.js # Surprise-me recommendation flows
│   │   ├── useToast.js            # Toast notifications
│   │   └── useWatchlistController.js # Watchlist + collections state and mutations
│   │
│   ├── lib/                       # External API wrappers & pure utility engines
│   │   ├── apiRateQuota.js        # TMDB/OMDb/Trakt API quota tracker
│   │   ├── collectionFilters.js   # Collection filtering logic
│   │   ├── collectionMovieRows.js # Collection movie row builders
│   │   ├── collectionPrefsStorage.js # Collection preference persistence
│   │   ├── collectionRows.js      # Collection row assembly
│   │   ├── countryPresets.js      # Global country names preset mapping
│   │   ├── defaultMovieWatchlist.js # Initial catalog data fallbacks
│   │   ├── defaultWatchlist.js    # Watchlist seed data
│   │   ├── discoverViewModel.js   # Discover search state machine
│   │   ├── errors.js              # Centralized error classifier
│   │   ├── homeFeed.js            # Home screen trending/discover loaders
│   │   ├── imdbTop100Catalog.js   # IMDb Top 100 static catalog
│   │   ├── languagePresets.js     # Curated regional language groupings
│   │   ├── omdb.js                # OMDb ratings API integration
│   │   ├── providerAvailability.js # Region/service availability resolution
│   │   ├── qrMatrix.js            # QR code matrix generator
│   │   ├── shareUtils.js          # View-shot canvas renderer and share wrapper
│   │   ├── spotify.js             # Spotify soundtrack lookups
│   │   ├── storage.js             # AsyncStorage key-value wrappers
│   │   ├── tmdb.js                # Core TMDB client (Search, Availability, Details)
│   │   ├── trakt.js               # Trakt live discovery client
│   │   ├── types.js               # JSDoc @typedef data-model definitions
│   │   ├── usePosterTheme.js      # Dynamic palette builder from poster colors
│   │   ├── useVoiceSearch.js      # Speech-to-text listener hook
│   │   ├── watchlistActions.js    # Pure watchlist reducers (collections/status/membership)
│   │   ├── watchlistBackup.js     # Watchlist JSON serialization manager
│   │   ├── watchlistCategories.js # Watchlist category schema definitions
│   │   ├── watchlistModel.js      # Watchlist row normalization helpers
│   │   ├── wikidataAwards.js      # Wikidata awards parsing
│   │   └── wikidataSoundtracks.js # Wikidata soundtrack parsing
│   │
│   ├── navigation/                # React Navigation stacks & shell
│   │   ├── AppShell.js            # Top-level shell wiring providers + tabs
│   │   ├── DiscoverStack.js       # Discover tab stack
│   │   ├── HomeStack.js           # Home tab stack
│   │   ├── navigationRef.js       # Imperative navigation ref
│   │   ├── navigationTheme.js     # React Navigation theme mapping
│   │   ├── RootTabs.js            # Bottom-tab navigator
│   │   ├── SearchStack.js         # Search tab stack
│   │   ├── SettingsStack.js       # Settings tab stack
│   │   ├── useStackScreenOptions.js # Shared stack screen options
│   │   └── WatchlistStack.js      # Watchlist tab stack
│   │
│   ├── theme/                     # Styling variables & theme providers
│   │   ├── ThemeProvider.js       # Context wrapper managing theme modes (Light/Dark/System)
│   │   └── tokens.js              # Theme metrics (colors, typography, radii, spacing)
│   │
│   └── utils/
│       └── responsive.js          # Fluid scale / verticalScale / scaleFont helpers
│
└── tests/                         # Node built-in test runner suites
    ├── collection-filters.test.js
    ├── collection-rows.test.js
    ├── discover-presets.test.js
    ├── provider-availability.test.js
    ├── release-config.test.js
    ├── watchlist-actions.test.js
    ├── watchlist-backup.test.js
    ├── watchlist-storage.test.js
    ├── wikidata-awards.test.js
    └── wikidata-soundtracks.test.js
```

---

## Technical Architecture & Design Patterns

### 🧬 Design System & Fluid Responsiveness
The app avoids hardcoded layouts by utilizing `src/utils/responsive.js`. This module dynamically evaluates the device's screen dimension ratios and pixel density to provide scaled values for spacing, sizes, and fonts:
* `scale(size)`: Scales widths proportionally.
* `verticalScale(size)`: Scales heights/vertical paddings.
* `scaleFont(size)`: Dynamically sizes fonts to avoid line clips on different densities.

### ⚡ Resilient Networking & Concurrency
The API layer in `src/lib/tmdb.js` implements defensive request strategies:
* **Exponential Backoff**: Automates requests retries upon facing temporary `5xx` server faults or local timeouts.
* **Concurrency Limiting**: Features a custom concurrency throttler (`mapWithConcurrency`) that pools TV episode queries to prevent rate limits (`429`) from APIs like TMDB/OMDb.
* **In-Memory Caches**: Caches core assets (e.g. genre tags, countries, languages) at the module level.

### 🎭 Theme Adaptability
* **Dynamic Backdrop Coloring**: Reads poster artworks to generate customized dark/light color gradients using `react-native-image-colors`.
* **Adaptive Contrast**: Automatically switches typography, dividers, and status bar styles to maintain readable contrast ratios.

---

## Environment Variables

Configure these settings inside a `.env` file at the root:

| Variable | Type | Description |
|---|---|---|
| `EXPO_PUBLIC_TMDB_TV_EPISODE_LOOKUP` | `boolean` | Set `true` to enable deep episode-level provider scans. |
| `EXPO_PUBLIC_TMDB_TV_EPISODE_MAX_EPISODES` | `number` | The max episodes scanned per show before falling back to series availability (Default: `60`). |

> **Authentication Note**: TMDB requests use a read-only bearer token bundled directly in `src/lib/tmdb.js`. This is a deliberate choice for a private, local-only hobby app — there is no backend or proxy, so the app works out of the box on a fresh clone.

---

## Development & Usage

### Prerequisite Setup
1. Install Node.js (v18+ recommended)
2. Install dependencies:
   ```bash
   npm install
   ```

### Start Development Server
Run the local Metro bundler:
```bash
npm run start
```
* Press `a` in the terminal to launch the app on a connected Android device or emulator (requires a dev build / `expo run:android`).

> Trova is **Android-only** (`app.json` declares `"platforms": ["android"]`). There is no iOS target.

### Running Test Suites
Execute the integrated Node unit tests:
```bash
npm run test
```

---

## Build & Release (Local Android Gradle)

Trova builds **locally with the native Android Gradle project** in `android/` — no EAS, no cloud builds. The `android/` directory is checked in (bare/prebuild workflow).

### 1. (Re)generate native project — only if needed
If you've changed `app.json` native config (plugins, permissions, icons) or are starting from a clean checkout without `android/`, regenerate it:
```bash
npx expo prebuild --platform android
```
> If `android/` already exists and is up to date, skip this step.

### 2. Build a debug APK (for quick on-device testing)
```bash
cd android
./gradlew assembleDebug          # macOS/Linux
.\gradlew.bat assembleDebug      # Windows (PowerShell)
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Build a release APK
```bash
cd android
./gradlew assembleRelease        # macOS/Linux
.\gradlew.bat assembleRelease    # Windows (PowerShell)
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

Install a built APK on a connected device with `adb install <path-to-apk>`. Build artifacts under `android/build/`, `android/app/build/`, and packaged `*.apk` / `*.aab` files are git-ignored.

---

## Attribution & Credits

* This product uses the **TMDB API** but is not endorsed or certified by TMDB.
* Streaming-availability data is sourced via TMDB's watch-provider endpoints, which are powered by **JustWatch**.
* Critic scores and additional metadata are provided by **OMDb**.
* Live discovery data is provided by **Trakt**.
* Awards and soundtrack data are sourced from **Wikidata**.

These credits are also surfaced in-app under **Settings → About / Credits**.
