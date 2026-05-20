# FindStreamer Mobile App (Trova)

FindStreamer (commercially branded as Trova) is a high-polish, cinematic mobile application designed to help movie and TV show enthusiasts discover new titles, check localized availability across streaming services (such as Netflix, Prime Video, Max, and Disney+), and curate their watchlists. Powered by TMDB and Trakt.tv, Trova delivers a premium, fluid user experience with a floating action bar, stackable bottom navigation sheets, custom toast notifications, and color-adaptive backdrop themes.

## Quick Start

Follow these steps to set up and run the application locally on your machine:

1. **Install Dependencies:**
   Make sure you have Node.js installed, then install the React Native and Expo package dependencies:
   ```bash
   npm install
   ```

2. **Start the Development Server:**
   Launch the Expo CLI local bundler:
   ```bash
   npx expo start
   ```

3. **Run on Simulators or Physical Devices:**
   - Press `a` in the terminal to launch the app on an Android emulator.
   - Press `i` in the terminal to launch the app on an iOS simulator.
   - Scan the QR code on your terminal using the Expo Go application on a physical phone to run on-device.

## Usage

The main entry point is `App.js`. To start the primary development server:
```bash
npx expo start
```

To build a production-ready preview APK via EAS Build:
```bash
eas build --platform android --profile preview
```

## Project Structure

```text
find-streamer/
├── App.js                         # Main entry point, theme wrappers, and root view controller
├── AGENT.md                       # AI Agent instructions
├── PROGRESS.md                    # Session progress and task logs
├── README.md                      # Project documentation and developer guide
├── app.json                       # Expo configuration
├── package.json                   # Project manifests, scripts, and npm dependencies
├── src/
│   ├── components/                # React Native UI components
│   │   ├── BottomNav.js           # Floating premium glassmorphic navigation bar capsule
│   │   ├── DiscoverScreen.js      # Advanced catalog search and search filters
│   │   ├── FilmographyScreen.js   # Director/creator/actor filmography grid
│   │   ├── HomeScreen.js          # Main feed featuring carousels, categories, and quick previews
│   │   ├── ResultView.js          # Cinematic detail screen with color-adaptive backdrops
│   │   ├── SettingsView.js        # Theme selections, JSON watchlist backup tools, and API rate panels
│   │   ├── StackBottomSheet.js    # Gesture-driven layered modal sheets
│   │   └── ...                    # Other premium UI sub-components
│   ├── context/                   # Global React State Contexts
│   │   └── BottomNavVisibilityContext.js # Dynamic scroll-tracking hide/show listener
│   ├── lib/                       # Business logic and external API wrappers
│   │   ├── apiRateQuota.js        # TMDB/OMDb/Trakt API quota tracker
│   │   ├── discoverViewModel.js   # Discover search state machine
│   │   ├── tmdb.js                # TMDB core client
│   │   ├── trakt.js               # Trakt live discovery client
│   │   └── watchlistCategories.js # Watchlist custom categorization schema
│   └── theme/                     # MD3 Design System, colors, typography, and corner radii
└── tests/                         # Test suites and mock configurations
```
