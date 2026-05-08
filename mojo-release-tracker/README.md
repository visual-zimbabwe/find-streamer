# Mojo Release Tracker

Mojo Release Tracker is a minimal Flask dashboard that scrapes Box Office Mojo's Domestic Release Calendar, caches monthly results in JSON, and renders a dark, mobile-responsive release browser with polished multi-select filters.

## Simplest Possible Version

The smallest useful MVP is:

- One Flask app with two routes: `/` for the dashboard and `/api/releases` for data.
- One scraper that requests `https://www.boxofficemojo.com/calendar/YYYY-MM-01/`.
- One JSON cache file at `cache/releases_cache.json`.
- One HTML page using Tailwind CDN and vanilla JavaScript.
- Browser-side filtering for multi-select distributor, genre, month, and year.

## Architecture Diagram

```text
[Browser]
   |
   | GET /
   v
[Flask app.py] ------------------------------+
   |                                         |
   | GET /api/releases?year=YYYY&month=MM    |
   v                                         |
[Cache service: releases_cache.json]         |
   | cache miss / refresh                    |
   v                                         |
[Scraper: requests + BeautifulSoup]          |
   |                                         |
   v                                         |
[Box Office Mojo calendar page]              |
   |                                         |
   +-----------------> parsed movies --------+
                             |
                             v
                    [JSON response to browser]
                             |
                             v
                    [Client-side filters + cards]
```

## Components

- `app.py`
  - Flask routes
  - input validation
  - scraper
  - cache read/write
  - error handling
- `templates/index.html`
  - dashboard layout
  - Tailwind styling
  - filter controls
  - fetch/render logic
- `cache/releases_cache.json`
  - keyed monthly cache store
- `requirements.txt`
  - Python dependencies

## Data Flow

1. User opens the dashboard.
2. Frontend requests `/api/releases` using the selected month and year.
3. Backend checks `cache/releases_cache.json`.
4. If cache is fresh, backend returns cached entries.
5. If cache is stale or refresh is forced, backend requests Box Office Mojo.
6. Scraper parses grouped release rows into normalized movie objects.
7. Backend stores the result in cache and returns JSON.
8. Frontend renders cards and applies local distributor/genre/month filter logic.

## Tech Stack

- Backend: Flask
- Scraping: `requests` + `BeautifulSoup4`
- Frontend: HTML5, Tailwind CSS CDN, Vanilla JavaScript
- Cache: local JSON file
- Deployment target for MVP: local machine or a basic VPS/container

## Step-by-Step Build Order

1. Create the project folder and install dependencies.
2. Build the Flask app shell and homepage route.
3. Implement the Box Office Mojo scraper for `YYYY-MM-01` URLs.
4. Add cache load/save helpers and TTL logic.
5. Expose `/api/releases` with month/year query params.
6. Build the Tailwind dashboard and dark-theme layout.
7. Add client-side distributor and filter logic.
8. Add loading, empty, and error states.
9. Verify parsing against a few different months.
10. Package with README instructions.

## Edge Cases

- Box Office Mojo returns `404` for an unavailable month.
- Page markup changes and the release table selector stops matching.
- A row has no listed genre or distributor.
- Cache file is missing or corrupted.
- A month page includes spillover dates from the next month.
- Duplicate titles appear in the same month.
- Slow upstream response or temporary request failure.
- User enters an invalid year or month.

## Scaling Strategy

- Keep the MVP single-process and JSON-backed.
- Next step: move cache from a file to Redis or SQLite.
- Pre-warm common months with a scheduled job instead of on-demand scraping.
- Store normalized release rows in a database for faster querying.
- Add server-side pagination and filtering if the dataset grows beyond a single month view.
- Add request throttling and background jobs to avoid multiple concurrent scrapes for the same month.

## Possible Bottlenecks

- Upstream request latency from Box Office Mojo.
- DOM parsing cost if pages get much larger.
- File lock contention if multiple workers write the same JSON cache.
- Full-page frontend rerenders if many months are loaded into memory at once.
- Breakage from source HTML changes.

## V2 Improvements

- Multi-month aggregation view.
- Persist history in SQLite/Postgres.
- Scheduled refresh jobs and stale-while-revalidate caching.
- Sort controls for date/title/distributor.
- Release detail pages with poster and cast metadata.
- Export to CSV/JSON.
- Playwright fallback for markup changes or JS-rendered pages.
- Basic auth and per-user saved filters.

## File Structure

```text
mojo-release-tracker/
├── app.py
├── requirements.txt
├── README.md
├── cache/
│   └── releases_cache.json   # created automatically on first run
└── templates/
    └── index.html
```

## Install and Run

```bash
cd mojo-release-tracker
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Then open [http://127.0.0.1:5000](http://127.0.0.1:5000).

## Notes

- The scraper targets the current Box Office Mojo grouped table markup.
- Cache entries expire after 12 hours by default.
- The frontend filters data client-side after a month is fetched.
