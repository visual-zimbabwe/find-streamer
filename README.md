# Trova — Premium Cinema & Streaming Discovery Companion

Trova (commercially branded version of **FindStreamer**) is a state-of-the-art, high-polish mobile application designed for movie and TV enthusiasts. It allows users to search globally for film/TV metadata, track localized streaming availability across major providers (Netflix, Amazon Prime Video, and Max), organize personal watchlists, and discover new titles through smart recommendations.

Built on **React Native** and **Expo SDK 55**, Trova features a cinematic design system with dynamic color-adaptive backdrops, fluid glassmorphic navigations, layered gesture-driven bottom sheets, and native sharing tools.

---

## Key Features

### 🔍 1. Live Search & Title Resolution
* **Instant Auto-Suggestions**: Debounced search-as-you-type using TMDB's multi-search endpoints.
* **Unified Person Routing**: Automatically detects actor/director/creator queries and routes directly to their detailed filmography grids.
* **Deep Resolution**: Merges primary metadata from **TMDB** with detailed critic scores and localized plot summaries from **OMDb**.

### 🌍 2. Global Streaming Availability
* **Country-by-Country Matrix**: Resolves watch provider data to display exactly which countries host a title on **Netflix**, **Prime Video**, and **Max**.
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
├── App.js                         # Main app entry, global state, and root navigation manager
├── AGENT.md                       # AI agent instruction guidelines
├── PROGRESS.md                    # Detailed log of project task completions
├── README.md                      # Comprehensive developer guide (This file)
├── app.json                       # Expo configuration manifest
├── eas.json                       # EAS Build profile settings
├── package.json                   # Project scripts and node dependencies
├── tsconfig.json                  # TypeScript compiler settings
├── src/
│   ├── components/                # Modular React Native UI components
│   │   ├── AppHeader.js           # Navigation bar with contextual back buttons
│   │   ├── BottomNav.js           # Floating premium glassmorphic navigation bar capsule
│   │   ├── DiscoverScreen.js      # Advanced discovery panel and search filters
│   │   ├── EmptyState.js          # Fallback screen for missing data/results
│   │   ├── ErrorBanner.js         # System error warnings
│   │   ├── FilmographyScreen.js   # Director/creator/actor filmography grid
│   │   ├── HomeScreen.js          # Feed carousels, categories, and quick previews
│   │   ├── MatchResults.js        # Search result list and action rows
│   │   ├── MediaArtwork.js        # Color-adaptive backdrop viewer
│   │   ├── ProgressiveBlur.js     # Gradient-based cinematic blur overlays
│   │   ├── ResultView.js          # Parallax detail view with provider matrices
│   │   ├── SearchPanel.js         # Debounced search bar with live auto-suggestions
│   │   ├── SettingsView.js        # UI theme picker, backup, and API rate panels
│   │   ├── ShareCard.js           # Social media card layout for view-shot canvas
│   │   ├── ShareOptionsSheet.js   # Custom share sheets
│   │   ├── SkeletonLoaders.js     # Fluid shimmer state placeholders
│   │   ├── StackBottomSheet.js    # Layered gesture-driven modal sheets
│   │   ├── StatePanel.js          # Retry panels for network/rate failures
│   │   ├── TrailerModal.js        # Floating trailer webview
│   │   └── WatchlistView.js       # Watchlist manager with subgroup filters
│   │
│   ├── context/                   # Global React State Contexts
│   │   └── BottomNavVisibilityContext.js # Dynamic scroll-tracking hide/show listener
│   │
│   ├── lib/                       # External API wrappers & utility engines
│   │   ├── apiRateQuota.js        # TMDB/OMDb/Trakt API quota tracker
│   │   ├── countryPresets.js      # Global country names preset mapping
│   │   ├── defaultMovieWatchlist.js # Initial catalog data fallbacks
│   │   ├── defaultWatchlist.js    # Watchlist mockup data seed
│   │   ├── discoverViewModel.js   # Discover search state machine
│   │   ├── errors.js              # Centralized error classifier
│   │   ├── homeFeed.js            # Home screen trending/discover loaders
│   │   ├── languagePresets.js     # Curated regional language groupings
│   │   ├── omdb.js                # OMDb ratings API integration
│   │   ├── qrMatrix.js            # QR code matrix generator
│   │   ├── shareUtils.js          # View-shot canvas renderer and share wrapper
│   │   ├── storage.js             # AsyncStorage key-value wrappers
│   │   ├── tmdb.js                # Core TMDB client (Search, Availability, Details)
│   │   ├── trakt.js               # Trakt live discovery client
│   │   ├── usePosterTheme.js      # Dynamic palette builder from poster colors
│   │   ├── useVoiceSearch.js      # Speech-to-text listener hook
│   │   ├── watchlistBackup.js     # Watchlist JSON serialization manager
│   │   └── watchlistCategories.js # Watchlist category schema definitions
│   │
│   └── theme/                     # Styling variables & theme providers
│       ├── ThemeProvider.js       # Context wrapper managing theme modes (Light/Dark/System)
│       └── tokens.js              # Theme metrics (colors, typography, radii, spacing)
│
└── tests/                         # Native test suites
    ├── release-hardening.test.js  # Build hardening verification
    └── watchlist-backup.test.js   # JSON import/export backup verification
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

> **Authentication Note**: TMDB requests rely on a secure bearer token authorization. A fallback token is compiled directly inside `src/lib/tmdb.js` to ensure the project works out of the box.

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
* Press `a` in the terminal to launch the app on an Android Emulator.
* Press `i` to launch the app on an iOS Simulator.
* Scan the console's QR code using the **Expo Go** application on a physical phone to run it on-device.

### Running Test Suites
Execute the integrated Node unit tests:
```bash
npm run test
```

---

## Build & Release Pipelines

Trova uses **Expo Application Services (EAS)** for production builds.

### 1. EAS Authentication
Log into the EAS CLI system (configured for the `juwimana` organization account):
```bash
npx eas login
```

### 2. Configure Projects
Sync project profiles and configuration IDs:
```bash
npx eas project:init
```

### 3. Build Platforms

* **Build Android Preview (Installable APK)**:
  ```bash
  npx eas build --platform android --profile preview
  ```
* **Build iOS Preview**:
  ```bash
  npx eas build --platform ios --profile preview
  ```
* **Build Android Production (Play Store AAB)**:
  ```bash
  npx eas build --platform android --profile production
  ```
