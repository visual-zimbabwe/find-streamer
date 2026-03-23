# Find Streamer Electron App

Desktop version of Find Streamer built with Electron.

## Run in dev mode

```powershell
cd .\electron-app
npm start
```

## Build Windows installer (.exe)

```powershell
cd .\electron-app
npm run build:win
```

Installer output:
- `electron-app\dist\Find Streamer-Setup-1.0.0.exe`

## Notes

- Uses TMDB via the same matching/metadata/availability logic as CLI.
- Supports hardcoded TMDB bearer token fallback and `TMDB_BEARER_TOKEN` override.
- When a search returns multiple titles, the app now shows the top matches and lets the user pick the exact movie or TV show before loading availability.
