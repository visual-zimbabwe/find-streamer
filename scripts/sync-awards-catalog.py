#!/usr/bin/env python3
"""
Annual / Scheduled Sync Script for Trova Awards Catalog
Queries Wikidata SPARQL for newly awarded festival & academy winners,
resolves new entries via TMDb, and updates src/data/awards_catalog.json & .js.
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

TMDB_API_KEY = "d90e408fc05fa0c35ebbbc220515d376"
WIKIDATA_USER_AGENT = "Trova/1.0 (juwimana.database@gmail.com)"

# Wikidata Award QIDs mapped to ceremony IDs in Trova
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

def fetch_tmdb_movie(tmdb_id):
    url = f"https://api.themoviedb.org/3/movie/{tmdb_id}?api_key={TMDB_API_KEY}"
    req = urllib.request.Request(url, headers={"User-Agent": "Trova/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"TMDb fetch error for ID {tmdb_id}: {e}")
        return None

def main():
    if not os.path.exists(JSON_PATH):
        print(f"Awards catalog file not found: {JSON_PATH}")
        sys.exit(1)

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
        print(f"Checking {ceremony['name']} (Wikidata {meta['qid']})...")

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

            winner_record = {
                "id": tmdb_id,
                "tmdbId": tmdb_id,
                "mediaType": "movie",
                "title": movie_data.get("title", ""),
                "originalTitle": movie_data.get("original_title", ""),
                "year": rel_date[:4] if len(rel_date) >= 4 else award_year,
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
            print(f"  + Added new winner: {winner_record['title']} ({award_year})")

    if new_winners_added > 0:
        catalog["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        catalog["totalUniqueWinners"] = len(all_winners_map)
        catalog["allWinners"] = list(all_winners_map.values())

        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(catalog, f, indent=2, ensure_ascii=False)

        with open(JS_PATH, "w", encoding="utf-8") as f:
            f.write("export const awardsData = " + json.dumps(catalog, indent=2, ensure_ascii=False) + ";\nexport default awardsData;\n")

        print(f"Sync complete: {new_winners_added} new winners added.")
    else:
        print("Sync complete: Catalog is already fully up to date.")

if __name__ == "__main__":
    main()
