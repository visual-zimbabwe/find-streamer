# Find Streamer Mobile (Expo)

Mobile app (iOS/Android) for the same TMDB-based workflow used in desktop/CLI.

## Features

- Search movie/TV title
- Show top TMDB matches when a title is ambiguous
- Let the user pick the exact movie or TV show before loading results
- Metadata: year, genres, rating, trailer, synopsis
- Country table with service columns: Netflix, Prime Video, Max
- Alphabetical country ordering

## Run

```powershell
cd .\mobile-app
npm install
npx expo start
```

Then scan the QR code in Expo Go, or run an emulator.

## Build Notes

For store builds, use EAS Build:

```powershell
npm install -g eas-cli
eas build:configure
eas build --platform android
```

You can similarly build for iOS with Apple developer setup.

### Android APK (direct install)

To always build an installable APK (not AAB), this project includes `eas.json` with a `preview` profile.

```powershell
cd .\mobile-app
eas build --platform android --profile preview
```

For Play Store submission builds (AAB), use:

```powershell
eas build --platform android --profile production
```

## Project Structure

```text
mobile-app/
├── .expo/
├── Trova/
│   ├── main_search/
│   ├── search_results/
│   └── watchlist_view/
├── app.json
├── App.js
├── eas.json
├── icon.png
├── package.json
├── README.md
├── settings.html
├── src/
├── tsconfig.json
└── watchlist.html
```

