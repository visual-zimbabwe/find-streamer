# Find Streamer

A simple CLI to find where a movie or TV show is available on:
- Netflix
- Amazon Prime Video
- Max (including HBO Max naming)

The output is global by country code (ISO-3166-1 alpha-2), using TMDB watch provider data.

## Setup

1. Create and activate your virtual environment.
2. No external Python dependencies are required.
3. Credentials:
- Script now includes a hardcoded TMDB v4 read token.
- Optional override: set `TMDB_BEARER_TOKEN` or `TMDB_API_KEY` in your environment.

```powershell
$env:TMDB_BEARER_TOKEN="YOUR_V4_READ_TOKEN"
# or
$env:TMDB_API_KEY="YOUR_V3_API_KEY"
```

## Usage

Interactive (type title only when prompted):

```powershell
python .\find_streamer.py
```

Direct command form (quotes optional):

```powershell
python .\find_streamer.py The Last of Us
```

If TMDB returns multiple movie/TV matches, the CLI now shows a numbered list and asks you to pick one before it fetches availability.

Example output:

```text
Multiple matches found for: One Life
1. One Life (movie, 2023)
2. One Life (tv, 2011)
Pick a title [1-2]: 1

Query: One Life
Matched: One Life (movie)
Year: 2023
Genres: Drama, History
TMDB Rating: 7.7/10
Trailer: https://www.youtube.com/watch?v=example
Synopsis: British stockbroker Nicholas Winton visits Czechoslovakia and helps rescue Jewish children before World War II.
```

## Notes

- Availability varies over time and by region.
- Data source is TMDB watch/providers.
- Output includes country names and country codes.
- Countries are sorted alphabetically by country name.
- Auth supports TMDB v4 bearer token or TMDB v3 API key.
