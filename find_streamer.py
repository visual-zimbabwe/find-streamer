import argparse
import json
import os
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from typing import Dict, List, Tuple

TMDB_BASE = "https://api.themoviedb.org/3"
HARDCODED_BEARER_TOKEN = (
    "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZWNkNDE1YWJhY2VmMzYxM2I5NDc1MWQ5OWRhODU2YSIsIm5iZiI6"
    "MTc3MTgwMDUzOS45ODU5OTk4LCJzdWIiOiI2OTliODdkYmYwMTE1NmYxNDljNWE1MTgiLCJzY29wZXMiOlsi"
    "YXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.oXCB5rLBXE6TwtgHGup4lEEX-dI0uTXGUVP8PQesics"
)
TARGET_SERVICES = {
    "netflix": "Netflix",
    "amazon_prime_video": "Amazon Prime Video",
    "max": "Max",
}
DIRECT_SERVICE_NAMES = {
    "netflix": {"netflix", "netflix standard with ads", "netflix basic with ads"},
    "amazon_prime_video": {"amazon prime video"},
    "max": {"max", "hbo max"},
}


def normalize(text: str) -> str:
    return "".join(ch.lower() for ch in text if ch.isalnum() or ch.isspace()).strip()


def service_key(provider_name: str) -> str | None:
    name = normalize(provider_name)
    for key, direct_names in DIRECT_SERVICE_NAMES.items():
        if name in direct_names:
            return key
    return None


def direct_flatrate_services(info: dict) -> set[str]:
    return {
        key
        for provider in info.get("flatrate", [])
        if (key := service_key(provider.get("provider_name", "")))
    }


def availability_from_results(results: dict) -> Dict[str, List[str]]:
    availability: Dict[str, List[str]] = defaultdict(list)

    for country_code, info in results.items():
        for key in direct_flatrate_services(info):
            availability[key].append(country_code)

    for key in availability:
        availability[key] = sorted(set(availability[key]))

    return availability


def tmdb_get(
    path: str,
    params: Dict[str, str] | None = None,
    bearer_token: str | None = None,
    api_key: str | None = None,
) -> dict:
    if not bearer_token and not api_key:
        raise ValueError("Missing TMDB credentials.")

    request_params = dict(params or {})
    headers = {"accept": "application/json"}

    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"
    else:
        request_params["api_key"] = api_key or ""

    query = ""
    if request_params:
        query = f"?{urlencode(request_params)}"

    req = Request(f"{TMDB_BASE}{path}{query}", headers=headers, method="GET")
    with urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def rank_candidate(query_norm: str, item: dict) -> Tuple[int, float]:
    title = item.get("title") or item.get("name") or ""
    title_norm = normalize(title)
    exact = 0 if title_norm == query_norm else 1
    return (exact, -item.get("popularity", 0.0))


def search_title_candidates(
    query: str, bearer_token: str | None, api_key: str | None, limit: int = 10
) -> List[dict]:
    data = tmdb_get(
        "/search/multi",
        params={"query": query, "include_adult": "false", "language": "en-US", "page": "1"},
        bearer_token=bearer_token,
        api_key=api_key,
    )

    candidates = [item for item in data.get("results", []) if item.get("media_type") in {"movie", "tv"}]
    if not candidates:
        raise ValueError(f"No movie or TV results found for: {query}")

    query_norm = normalize(query)
    sorted_candidates = sorted(candidates, key=lambda item: rank_candidate(query_norm, item))

    matches: List[dict] = []
    for item in sorted_candidates[:limit]:
        title = item.get("title") or item.get("name") or "(Untitled)"
        date_value = item.get("release_date") or item.get("first_air_date") or ""
        year = date_value[:4] if len(date_value) >= 4 else "N/A"
        poster_path = item.get("poster_path")
        backdrop_path = item.get("backdrop_path")
        matches.append(
            {
                "media_type": item["media_type"],
                "tmdb_id": int(item["id"]),
                "title": title,
                "year": year,
                "synopsis": (item.get("overview") or "").strip() or "No synopsis available.",
                "poster_url": f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else "N/A",
                "backdrop_url": f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else "N/A",
            }
        )
    return matches


def choose_candidate(query: str, matches: List[dict]) -> dict:
    if len(matches) == 1:
        return matches[0]

    print(f"Multiple matches found for: {query}")
    for index, match in enumerate(matches, start=1):
        print(f"{index}. {match['title']} ({match['media_type']}, {match['year']})")

    while True:
        choice = input(f"Pick a title [1-{len(matches)}]: ").strip()
        if choice.isdigit():
            selected = int(choice)
            if 1 <= selected <= len(matches):
                return matches[selected - 1]
        print("Enter a valid number from the list.", file=sys.stderr)


def get_provider_countries(
    media_type: str, tmdb_id: int, bearer_token: str | None, api_key: str | None
) -> Dict[str, List[str]]:
    if media_type == "tv":
        return get_tv_complete_provider_countries(tmdb_id, bearer_token, api_key)

    data = tmdb_get(
        f"/{media_type}/{tmdb_id}/watch/providers",
        bearer_token=bearer_token,
        api_key=api_key,
    )
    return availability_from_results(data.get("results", {}))


def get_tv_complete_provider_countries(
    tmdb_id: int, bearer_token: str | None, api_key: str | None
) -> Dict[str, List[str]]:
    details = tmdb_get(
        f"/tv/{tmdb_id}",
        params={"language": "en-US"},
        bearer_token=bearer_token,
        api_key=api_key,
    )
    episodes = [
        (season.get("season_number"), episode_number)
        for season in details.get("seasons", [])
        if season.get("season_number", 0) > 0
        for episode_number in range(1, season.get("episode_count", 0) + 1)
    ]
    availability: Dict[str, set[str] | None] = {key: None for key in TARGET_SERVICES}

    if not episodes:
        data = tmdb_get(
            f"/tv/{tmdb_id}/watch/providers",
            bearer_token=bearer_token,
            api_key=api_key,
        )
        return availability_from_results(data.get("results", {}))

    def get_episode_results(episode: tuple[int, int]) -> dict:
        season_number, episode_number = episode
        data = tmdb_get(
            f"/tv/{tmdb_id}/season/{season_number}/episode/{episode_number}/watch/providers",
            bearer_token=bearer_token,
            api_key=api_key,
        )
        return data.get("results", {})

    with ThreadPoolExecutor(max_workers=min(8, len(episodes))) as executor:
        episode_results_list = list(executor.map(get_episode_results, episodes))

    for episode_results in episode_results_list:
        episode_availability: Dict[str, set[str]] = {key: set() for key in TARGET_SERVICES}

        for country_code, info in episode_results.items():
            for key in direct_flatrate_services(info):
                episode_availability[key].add(country_code)

        for key, country_codes in episode_availability.items():
            availability[key] = country_codes if availability[key] is None else availability[key] & country_codes

    return {key: sorted(country_codes or set()) for key, country_codes in availability.items()}


def get_title_metadata(
    media_type: str, tmdb_id: int, bearer_token: str | None, api_key: str | None
) -> Tuple[str, str, str, str]:
    data = tmdb_get(
        f"/{media_type}/{tmdb_id}",
        params={"language": "en-US", "append_to_response": "videos"},
        bearer_token=bearer_token,
        api_key=api_key,
    )

    date_value = data.get("release_date") or data.get("first_air_date") or ""
    year = date_value[:4] if len(date_value) >= 4 else "N/A"

    genres = [item.get("name", "").strip() for item in data.get("genres", []) if item.get("name")]
    genres_text = ", ".join(sorted(genres)) if genres else "N/A"

    vote_average = data.get("vote_average")
    rating = f"{vote_average:.1f}/10" if isinstance(vote_average, (int, float)) else "N/A"

    videos = data.get("videos", {}).get("results", [])
    youtube_videos = [v for v in videos if v.get("site") == "YouTube" and v.get("key")]
    trailer = next(
        (v for v in youtube_videos if v.get("type") == "Trailer" and v.get("official") is True),
        None,
    )
    if not trailer:
        trailer = next((v for v in youtube_videos if v.get("type") == "Trailer"), None)
    if not trailer and youtube_videos:
        trailer = youtube_videos[0]
    trailer_url = f"https://www.youtube.com/watch?v={trailer['key']}" if trailer else "N/A"

    return year, genres_text, rating, trailer_url


def get_country_names(bearer_token: str | None, api_key: str | None) -> Dict[str, str]:
    data = tmdb_get(
        "/configuration/countries",
        params={"language": "en-US"},
        bearer_token=bearer_token,
        api_key=api_key,
    )

    names: Dict[str, str] = {}
    for item in data:
        code = item.get("iso_3166_1", "")
        name = item.get("english_name") or item.get("name") or code
        if code:
            names[code] = name
    return names


def print_report(
    query: str, resolved_title: str, media_type: str, synopsis: str, year: str, genres: str, rating: str, trailer: str
) -> None:
    print(f"Query: {query}")
    print(f"Matched: {resolved_title} ({media_type})")
    print(f"Year: {year}")
    print(f"Genres: {genres}")
    print(f"TMDB Rating: {rating}")
    print(f"Trailer: {trailer}")
    print(f"Synopsis: {synopsis}")
    print()


def print_table(availability: Dict[str, List[str]], country_names: Dict[str, str]) -> None:
    service_country_sets = {key: set(codes) for key, codes in availability.items()}
    all_codes = sorted({code for codes in availability.values() for code in codes})

    if not all_codes:
        print("No availability found for Netflix, Amazon Prime Video, or Max.")
        return

    service_headers = [TARGET_SERVICES["netflix"], TARGET_SERVICES["amazon_prime_video"], TARGET_SERVICES["max"]]
    headers = ["Country", "Code", *service_headers]

    rows: List[List[str]] = []
    for code in all_codes:
        country = country_names.get(code, code)
        row = [
            country,
            code,
            "Yes" if code in service_country_sets.get("netflix", set()) else "",
            "Yes" if code in service_country_sets.get("amazon_prime_video", set()) else "",
            "Yes" if code in service_country_sets.get("max", set()) else "",
        ]
        rows.append(row)

    rows.sort(key=lambda row: (row[0].lower(), row[1]))

    widths = [len(h) for h in headers]
    for row in rows:
        for i, value in enumerate(row):
            widths[i] = max(widths[i], len(value))

    def fmt_row(values: List[str]) -> str:
        return " | ".join(value.ljust(widths[i]) for i, value in enumerate(values))

    separator = "-+-".join("-" * w for w in widths)

    print(fmt_row(headers))
    print(separator)
    for row in rows:
        print(fmt_row(row))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Find global country availability for Netflix, Amazon Prime Video, and Max."
    )
    parser.add_argument("query", nargs="*", help="Movie or TV show title to search")
    args = parser.parse_args()

    query = " ".join(args.query).strip()
    if not query:
        query = input("Movie/TV title: ").strip()
    if not query:
        print("Please enter a movie or TV show title.", file=sys.stderr)
        return 1

    bearer_token = os.getenv("TMDB_BEARER_TOKEN") or HARDCODED_BEARER_TOKEN
    api_key = os.getenv("TMDB_API_KEY")
    if not bearer_token and not api_key:
        print("Missing TMDB credentials.", file=sys.stderr)
        print("Set TMDB_BEARER_TOKEN (v4 token) or TMDB_API_KEY (v3 key).", file=sys.stderr)
        return 1

    try:
        matches = search_title_candidates(query, bearer_token, api_key)
        selected = choose_candidate(query, matches)
        media_type = selected["media_type"]
        tmdb_id = selected["tmdb_id"]
        resolved_title = selected["title"]
        synopsis = selected["synopsis"]
        year, genres, rating, trailer = get_title_metadata(media_type, tmdb_id, bearer_token, api_key)
        availability = get_provider_countries(media_type, tmdb_id, bearer_token, api_key)
        country_names = get_country_names(bearer_token, api_key)
    except HTTPError as exc:
        print(f"TMDB API request failed: {exc}", file=sys.stderr)
        return 2
    except URLError as exc:
        print(f"Network error while calling TMDB: {exc}", file=sys.stderr)
        return 2
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 3

    print_report(query, resolved_title, media_type, synopsis, year, genres, rating, trailer)
    print_table(availability, country_names)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
