# FindStreamer Mobile App

FindStreamer is a premium mobile application designed to help users discover movies and TV shows and check their streaming availability across various services like Netflix, Prime Video, and Max. It features an advanced discovery engine with inclusive/exclusive filtering, language presets, region grouping, person-based filmographies, and localized availability data.

## Current Phase
Advanced Discover Filters — Language presets by region and English-exclusion.

## Quick Start

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Start Development Server:**
    ```bash
    npx expo start
    ```
3.  **Run on Android/iOS:**
    Press `a` for Android or `i` for iOS in the terminal after starting the dev server.

## Usage

The main entry point is `App.js`. The application uses Expo and React Native.
To build a preview APK:
```bash
eas build --platform android --profile preview
```

## Project Structure

```text
find-streamer/
├── App.js                  # Main entry point and navigation state
├── AGENT.md                # Agent-specific instructions
├── PROGRESS.md             # Project roadmap and session memory
├── README.md               # Project documentation
├── app.json                # Expo configuration
├── package.json            # Dependencies and scripts
├── src/
│   ├── components/         # React Native UI components
│   │   ├── DiscoverScreen.js     # Advanced discovery engine UI
│   │   ├── FilmographyScreen.js  # Person filmography view
│   │   ├── ResultView.js         # Media details and availability
│   │   └── ...                   # Other UI components
│   ├── lib/                # Business logic and API utilities
│   │   ├── tmdb.js               # TMDB API wrapper
│   │   ├── discoverViewModel.js
│   │   ├── languagePresets.js
│   │   ├── shareUtils.js
│   │   ├── storage.js
│   │   ├── tmdb.js
│   │   └── watchlistCategories.js
│   └── theme/              # Styling and design system
└── tests/                  # Test suite
```
