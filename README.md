# Find Streamer

Find Streamer is a tool set to find where a movie or TV show is available for streaming on Netflix, Amazon Prime Video, and Max. It includes a Python CLI for quick terminal lookups and an Expo-based Mobile App for a premium on-the-go experience.

## Quick Start

### CLI (Python)
1. Create and activate a virtual environment.
2. Run `python .\find_streamer.py`.
3. Enter a movie or TV show title when prompted.

### Mobile App (Expo)
1. Navigate to the `mobile-app` directory.
2. Run `npm install`.
3. Start the app with `npx npx expo start`.
4. Open the app in the Expo Go app on your phone.

## Usage

### CLI
```powershell
python .\find_streamer.py "Inception"
```

### Mobile App
- **Search**: Enter a title in the search bar. The app tracks your last 3 **Recent Searches** for quick access.
- **Watchlist**: Save titles you want to watch later.
- **Navigation**: Simple and focused bottom navigation with only Search and Watchlist.

## Project Structure

```text
find-streamer/
├── find_streamer.py      # Main CLI entry point
├── requirements.txt      # CLI dependencies
├── mobile-app/           # Expo Mobile Application
│   ├── App.js            # Mobile entry point
│   ├── Trova/            # Frontend assets and views
│   │   ├── main_search/  # Search screen (Recent Searches)
│   │   ├── watchlist_view/ # Watchlist screen
│   │   └── search_results/ # Results display
│   └── src/              # Expo components and theme
└── README.md             # Project documentation
```

## Features

- **Multi-Platform Search**: Works for Movies and TV Shows.
- **Recent Searches**: Keeps track of your last 3 searches locally for fast access.
- **Focused Navigation**: Clean UI with only Search and Watchlist options.
- **Rich Metadata**: Viewing year, rating, trailer, and synopsis.
- **Fallback Logic**: Handles ambiguous titles with a selection list.
- **Global Availability**: Shows streaming options across different countries.

