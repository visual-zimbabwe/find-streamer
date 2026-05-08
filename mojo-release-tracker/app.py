from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request


APP_DIR = Path(__file__).resolve().parent
CACHE_DIR = APP_DIR / "cache"
CACHE_FILE = CACHE_DIR / "releases_cache.json"
BOX_OFFICE_MOJO_URL = "https://www.boxofficemojo.com/calendar/{date}/"
CACHE_TTL_SECONDS = 60 * 60 * 12
REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

app = Flask(__name__)


def ensure_cache_dir() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def load_cache() -> dict[str, Any]:
    ensure_cache_dir()
    if not CACHE_FILE.exists():
        return {}

    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_cache(cache: dict[str, Any]) -> None:
    ensure_cache_dir()
    CACHE_FILE.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def normalize_year_month(year: int, month: int) -> tuple[int, int]:
    if year < 1970 or year > 2100:
        raise ValueError("Year must be between 1970 and 2100.")
    if month < 1 or month > 12:
        raise ValueError("Month must be between 1 and 12.")
    return year, month


def cache_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def is_cache_fresh(year: int, month: int, entry: dict[str, Any]) -> bool:
    now = datetime.now(timezone.utc)

    # Historical calendars are immutable enough for this dashboard.
    if year < now.year or (year == now.year and month < now.month):
        return True

    fetched_at = entry.get("fetched_at")
    if not fetched_at:
        return False

    try:
        fetched_dt = datetime.fromisoformat(fetched_at)
    except ValueError:
        return False

    age_seconds = (now - fetched_dt).total_seconds()
    return age_seconds < CACHE_TTL_SECONDS


def build_calendar_url(year: int, month: int) -> str:
    return BOX_OFFICE_MOJO_URL.format(date=f"{year:04d}-{month:02d}-01")


def extract_text(node: Any) -> str:
    if not node:
        return ""
    return " ".join(node.get_text(" ", strip=True).split())


def parse_genres(node: Any) -> list[str]:
    if not node:
        return []

    raw_tokens = [text.strip() for text in node.stripped_strings if text.strip()]
    if len(raw_tokens) > 1:
        return raw_tokens

    flat_text = extract_text(node)
    if not flat_text:
        return []

    # Box Office Mojo sometimes renders genres as one whitespace-separated string.
    return [token for token in flat_text.split() if token]


def parse_release_date(label: str) -> str:
    parsed = datetime.strptime(label, "%B %d, %Y")
    return parsed.date().isoformat()


def parse_releases(html: str, source_url: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("table.mojo-body-table")
    if table is None:
        raise ValueError("Release table not found. Box Office Mojo markup may have changed.")

    releases: list[dict[str, Any]] = []
    current_date = ""

    for row in table.select("tr"):
        group_header = row.select_one("th.mojo-table-header")
        if group_header:
            current_date = parse_release_date(extract_text(group_header))
            continue

        cells = row.find_all("td")
        if len(cells) < 3 or not current_date:
            continue

        title = extract_text(cells[0].find("h3"))
        if not title:
            continue

        genre_block = cells[0].select_one(".mojo-schedule-genres")
        genres = parse_genres(genre_block)
        distributor = extract_text(cells[1]) or "Unknown"
        scale = extract_text(cells[2]) or "Unknown"

        releases.append(
            {
                "title": title,
                "release_date": current_date,
                "distributor": distributor,
                "genre": ", ".join(genres) if genres else "Unknown",
                "genres": genres,
                "scale": scale,
                "source_url": source_url,
            }
        )

    if not releases:
        raise ValueError("No releases were found for the requested calendar page.")

    return releases


def scrape_releases(year: int, month: int) -> dict[str, Any]:
    source_url = build_calendar_url(year, month)

    try:
        response = requests.get(source_url, headers=REQUEST_HEADERS, timeout=20)
    except requests.RequestException as exc:
        raise RuntimeError(f"Unable to reach Box Office Mojo: {exc}") from exc

    if response.status_code in {400, 404}:
        raise FileNotFoundError("Calendar page not found for that month/year.")
    if response.status_code >= 400:
        raise RuntimeError(f"Box Office Mojo returned HTTP {response.status_code}.")

    releases = parse_releases(response.text, source_url)
    return {
        "year": year,
        "month": month,
        "source_url": source_url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "releases": releases,
    }


def get_releases(year: int, month: int, force_refresh: bool = False) -> dict[str, Any]:
    year, month = normalize_year_month(year, month)
    cache = load_cache()
    key = cache_key(year, month)
    cached_entry = cache.get(key)

    if cached_entry and not force_refresh and is_cache_fresh(year, month, cached_entry):
        return {**cached_entry, "cache_status": "hit"}

    scraped = scrape_releases(year, month)
    cache[key] = scraped
    save_cache(cache)
    return {**scraped, "cache_status": "miss"}


@app.get("/")
def index() -> str:
    today = datetime.now()
    return render_template("index.html", current_year=today.year, current_month=today.month)


@app.get("/api/releases")
def api_releases():
    try:
        year = int(request.args.get("year", datetime.now().year))
        month = int(request.args.get("month", datetime.now().month))
        force_refresh = request.args.get("refresh", "").lower() == "true"
        payload = get_releases(year, month, force_refresh=force_refresh)
        return jsonify({"ok": True, **payload})
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    except FileNotFoundError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 404
    except RuntimeError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 502
    except Exception:
        return (
            jsonify(
                {
                    "ok": False,
                    "error": "Unexpected server error while loading releases.",
                }
            ),
            500,
        )


if __name__ == "__main__":
    app.run(debug=True)
