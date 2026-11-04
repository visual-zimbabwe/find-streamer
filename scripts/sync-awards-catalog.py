#!/usr/bin/env python3
"""
Annual / Scheduled Sync Script for Trova Awards Catalog (Movies & TV Shows)
Queries Wikidata SPARQL for newly awarded festival & academy winners,
resolves new entries via TMDb (direct TMDb ID or IMDb ID /find fallback),
and updates:
  - src/data/awards_catalog.json & .js (Global Cinema Honors)
  - src/data/tv_awards_catalog.json & .js (Global Television Honors)
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(BASE_DIR, "src", "data", "awards_catalog.json")
JS_PATH = os.path.join(BASE_DIR, "src", "data", "awards_catalog.js")
TV_JSON_PATH = os.path.join(BASE_DIR, "src", "data", "tv_awards_catalog.json")
TV_JS_PATH = os.path.join(BASE_DIR, "src", "data", "tv_awards_catalog.js")

TMDB_API_KEY = "d90e408fc05fa0c35ebbbc220515d376"
WIKIDATA_USER_AGENT = "Trova/1.0 (juwimana.database@gmail.com)"

# Wikidata Award QIDs mapped to movie ceremony IDs in Trova
WIKIDATA_CEREMONY_MAP = {
    "cannes": {"qid": "Q179808", "awardName": "Palme d'Or"},
    "oscars_picture": {"qid": "Q102427", "awardName": "Academy Award for Best Picture"},
    "oscars_international": {"qid": "Q105304", "awardName": "Best International Feature Film"},
    "venice": {"qid": "Q209459", "awardName": "Golden Lion (Leone d'Oro)"},
    "berlin": {"qid": "Q2512671", "awardName": "Golden Bear (Goldener Bär)"},
    "tiff": {"qid": "Q39087364", "awardName": "People's Choice Award"},
    "cesar": {"qid": "Q645595", "awardName": "Meilleur Film (Best Film)"},
    "goya": {"qid": "Q1467554", "awardName": "Mejor Película (Best Film)"},
    "efa": {"qid": "Q777921", "awardName": "European Film Award for Best Film"},
}

def query_wikidata_winners(award_qid):
    sparql = f"""
    SELECT DISTINCT ?item ?itemLabel ?date ?tmdbId WHERE {{
      ?item p:P166 ?statement .
      ?statement ps:P166 wd:{award_qid} .
      OPTIONAL {{ ?statement pq:P585 ?date . }}
      OPTIONAL {{ ?item wdt:P4947 ?tmdbId . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    ORDER BY DESC(?date)
    LIMIT 20
    """
    url = f"https://query.wikidata.org/sparql?query={urllib.parse.quote(sparql)}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": WIKIDATA_USER_AGENT, "Accept": "application/sparql-results+json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("results", {}).get("bindings", [])
    except Exception as e:
        print(f"Wikidata SPARQL error for {award_qid}: {e}")
        return []

def query_wikidata_tv_winners(award_qid):
    """
    Queries Wikidata SPARQL for TV series winning `award_qid`, handling both:
    - Direct P166 on the TV series
    - P166 on a season/episode rolled up to the parent series via wdt:P179
    """
    sparql = f"""
    SELECT DISTINCT ?series ?seriesLabel ?date ?tmdbId ?imdbId WHERE {{
      {{
        ?series p:P166 ?stmt .
        ?stmt ps:P166 wd:{award_qid} .
        OPTIONAL {{ ?stmt pq:P585 ?date . }}
      }} UNION {{
        ?sub p:P166 ?stmt .
        ?stmt ps:P166 wd:{award_qid} .
        ?sub wdt:P179 ?series .
        OPTIONAL {{ ?stmt pq:P585 ?date . }}
      }}
      ?series wdt:P31/wdt:P279* wd:Q5398426 .
      OPTIONAL {{ ?series wdt:P4983 ?tmdbId . }}
      OPTIONAL {{ ?series wdt:P345 ?imdbId . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    ORDER BY DESC(?date)
    LIMIT 25
    """
    url = f"https://query.wikidata.org/sparql?query={urllib.parse.quote(sparql)}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": WIKIDATA_USER_AGENT, "Accept": "application/sparql-results+json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("results", {}).get("bindings", [])
    except Exception as e:
        print(f"Wikidata TV SPARQL error for {award_qid}: {e}")
        return []

def fetch_tmdb_movie(tmdb_id):
    url = f"https://api.themoviedb.org/3/movie/{tmdb_id}?api_key={TMDB_API_KEY}"
    req = urllib.request.Request(url, headers={"User-Agent": "Trova/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"TMDb fetch error for movie ID {tmdb_id}: {e}")
        return None

def fetch_tmdb_tv(tmdb_id):
    url = f"https://api.themoviedb.org/3/tv/{tmdb_id}?api_key={TMDB_API_KEY}"
    req = urllib.request.Request(url, headers={"User-Agent": "Trova/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"TMDb fetch error for TV ID {tmdb_id}: {e}")
        return None

def find_tmdb_tv_by_imdb(imdb_id):
    url = f"https://api.themoviedb.org/3/find/{imdb_id}?api_key={TMDB_API_KEY}&external_source=imdb_id"
    req = urllib.request.Request(url, headers={"User-Agent": "Trova/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            tv_results = data.get("tv_results", [])
            if tv_results:
                return tv_results[0]
            for ep in data.get("tv_episode_results", []):
                show_id = ep.get("show_id")
                if show_id:
                    return fetch_tmdb_tv(show_id)
    except Exception:
        pass
    return None

def sync_movie_catalog():
    if not os.path.exists(JSON_PATH):
        print(f"Movie awards catalog file not found: {JSON_PATH}")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    ceremonies_map = {c["id"]: c for c in catalog.get("ceremonies", [])}
    all_winners_map = {w["id"]: w for w in catalog.get("allWinners", [])}

    new_winners_added = 0

    for ceremony_id, meta in WIKIDATA_CEREMONY_MAP.items():
        ceremony = ceremonies_map.get(ceremony_id)
        if not ceremony:
            continue

        existing_film_ids = {w["id"] for w in ceremony.get("winners", [])}
        print(f"[Movies] Checking {ceremony['name']} (Wikidata {meta['qid']})...")

        bindings = query_wikidata_winners(meta["qid"])
        for b in bindings:
            tmdb_id_str = b.get("tmdbId", {}).get("value")
            if not tmdb_id_str or not tmdb_id_str.isdigit():
                continue

            tmdb_id = int(tmdb_id_str)
            if tmdb_id in existing_film_ids:
                continue

            date_str = b.get("date", {}).get("value", "")
            award_year = date_str[:4] if len(date_str) >= 4 else str(time.gmtime().tm_year)

            movie_data = fetch_tmdb_movie(tmdb_id)
            if not movie_data:
                continue

            poster_path = movie_data.get("poster_path")
            backdrop_path = movie_data.get("backdrop_path")
            vote_avg = round(movie_data.get("vote_average", 0), 2)
            rel_date = movie_data.get("release_date", "")
            orig_lang = (movie_data.get("original_language") or "").lower().strip()

            winner_record = {
                "id": tmdb_id,
                "tmdbId": tmdb_id,
                "mediaType": "movie",
                "title": movie_data.get("title", ""),
                "originalTitle": movie_data.get("original_title", ""),
                "year": rel_date[:4] if len(rel_date) >= 4 else award_year,
                "originalLanguage": orig_lang,
                "originalLanguageCode": orig_lang,
                "posterUrl": f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None,
                "backdropUrl": f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else None,
                "rating": f"{round(vote_avg, 1)}/10" if vote_avg > 0 else "NR",
                "ratingValue": vote_avg,
                "voteCount": movie_data.get("vote_count", 0),
                "overview": movie_data.get("overview", ""),
                "releaseDate": rel_date,
                "awardYear": award_year,
                "award": meta["awardName"],
                "position": 1,
                "ceremonyId": ceremony_id,
                "ceremonyName": ceremony["name"],
                "director": "",
            }

            ceremony["winners"].insert(0, winner_record)
            ceremony["winnersCount"] = len(ceremony["winners"])
            existing_film_ids.add(tmdb_id)

            if tmdb_id not in all_winners_map:
                all_winners_map[tmdb_id] = {
                    **winner_record,
                    "awards": [],
                }
            all_winners_map[tmdb_id]["awards"].append({
                "ceremonyId": ceremony_id,
                "ceremonyName": ceremony["name"],
                "award": meta["awardName"],
                "year": award_year,
                "position": 1,
            })

            new_winners_added += 1
            print(f"  + Added new movie winner: {winner_record['title']} ({award_year})")

    if new_winners_added > 0:
        catalog["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        catalog["totalUniqueWinners"] = len(all_winners_map)
        catalog["allWinners"] = list(all_winners_map.values())

        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(catalog, f, indent=2, ensure_ascii=False)

        with open(JS_PATH, "w", encoding="utf-8") as f:
            f.write("export const awardsData = " + json.dumps(catalog, indent=2, ensure_ascii=False) + ";\nexport default awardsData;\n")

        print(f"Movie sync complete: {new_winners_added} new winners added.")
    else:
        print("Movie sync complete: Catalog is already fully up to date.")

def sync_tv_catalog():
    if not os.path.exists(TV_JSON_PATH):
        print(f"TV awards catalog file not found: {TV_JSON_PATH}")
        return

    with open(TV_JSON_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    ceremonies = catalog.get("ceremonies", [])
    all_winners_map = {w["id"]: w for w in catalog.get("allWinners", [])}

    new_winners_added = 0

    for ceremony in ceremonies:
        ceremony_id = ceremony["id"]
        qid = ceremony.get("wikidataId")
        if not qid:
            continue

        existing_tv_ids = {w["id"] for w in ceremony.get("winners", [])}
        print(f"[TV] Checking {ceremony['name']} (Wikidata {qid})...")

        bindings = query_wikidata_tv_winners(qid)
        for b in bindings:
            tmdb_id_str = b.get("tmdbId", {}).get("value", "")
            imdb_id_str = b.get("imdbId", {}).get("value", "")

            tv_data = None
            if tmdb_id_str and tmdb_id_str.isdigit():
                if int(tmdb_id_str) in existing_tv_ids:
                    continue
                tv_data = fetch_tmdb_tv(int(tmdb_id_str))
            elif imdb_id_str and imdb_id_str.startswith("tt"):
                tv_data = find_tmdb_tv_by_imdb(imdb_id_str)

            if not tv_data or not tv_data.get("id"):
                continue

            tmdb_id = int(tv_data["id"])
            if tmdb_id in existing_tv_ids:
                continue

            poster_path = tv_data.get("poster_path")
            if not poster_path:
                continue

            backdrop_path = tv_data.get("backdrop_path")
            vote_avg = round(tv_data.get("vote_average", 0), 2)
            rel_date = tv_data.get("first_air_date") or tv_data.get("release_date") or ""
            date_str = b.get("date", {}).get("value", "")
            award_year = date_str[:4] if len(date_str) >= 4 else (rel_date[:4] if len(rel_date) >= 4 else str(time.gmtime().tm_year))
            orig_lang = (tv_data.get("original_language") or "").lower().strip()

            winner_record = {
                "id": tmdb_id,
                "tmdbId": tmdb_id,
                "mediaType": "tv",
                "title": tv_data.get("name") or tv_data.get("title") or "",
                "originalTitle": tv_data.get("original_name") or tv_data.get("original_title") or "",
                "year": rel_date[:4] if len(rel_date) >= 4 else award_year,
                "originalLanguage": orig_lang,
                "originalLanguageCode": orig_lang,
                "posterUrl": f"https://image.tmdb.org/t/p/w500{poster_path}",
                "backdropUrl": f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else None,
                "rating": f"{round(vote_avg, 1)}/10" if vote_avg > 0 else "NR",
                "ratingValue": vote_avg,
                "voteCount": tv_data.get("vote_count", 0),
                "overview": tv_data.get("overview", ""),
                "releaseDate": rel_date,
                "awardYear": award_year,
                "award": ceremony.get("awardName", ""),
                "position": 1,
                "ceremonyId": ceremony_id,
                "ceremonyName": ceremony["name"],
            }

            ceremony["winners"].insert(0, winner_record)
            ceremony["winnersCount"] = len(ceremony["winners"])
            existing_tv_ids.add(tmdb_id)

            if tmdb_id not in all_winners_map:
                all_winners_map[tmdb_id] = {
                    **winner_record,
                    "awards": [],
                }
            all_winners_map[tmdb_id]["awards"].append({
                "ceremonyId": ceremony_id,
                "ceremonyName": ceremony["name"],
                "award": ceremony.get("awardName", ""),
                "year": award_year,
                "position": 1,
            })

            new_winners_added += 1
            print(f"  + Added new TV winner: {winner_record['title']} ({award_year})")

    if new_winners_added > 0:
        catalog["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        catalog["totalUniqueWinners"] = len(all_winners_map)
        catalog["allWinners"] = list(all_winners_map.values())

        with open(TV_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(catalog, f, indent=2, ensure_ascii=False)

        with open(TV_JS_PATH, "w", encoding="utf-8") as f:
            f.write("export const tvAwardsData = " + json.dumps(catalog, indent=2, ensure_ascii=False) + ";\nexport default tvAwardsData;\n")

        print(f"TV sync complete: {new_winners_added} new winners added.")
    else:
        print("TV sync complete: Catalog is already fully up to date.")

def main():
    sync_movie_catalog()
    sync_tv_catalog()

if __name__ == "__main__":
    main()
