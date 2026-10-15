#!/usr/bin/env python3
"""
Gold-Standard Curated Catalog Builder for Trova (find-streamer)
Fetches TMDB collection metadata (vote_count, popularity, adult flag),
applies multi-dimensional quality gates, and writes out a pristine,
curated collection_movies.json.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

TMDB_API_KEY = "d90e408fc05fa0c35ebbbc220515d376"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(BASE_DIR, "collection_movies.json")
CACHE_PATH = os.path.join(BASE_DIR, "scripts", ".tmdb_collection_cache.json")

POPULAR_FRANCHISE_KEYWORDS = [
    'star wars', 'the lord of the rings', 'lord of the rings', 'harry potter', 'the godfather',
    'godfather', 'the dark knight', 'dark knight', 'indiana jones', 'james bond',
    'mission: impossible', 'mission impossible', 'pirates of the caribbean', 'toy story',
    'jurassic park', 'alien', 'the matrix', 'matrix', 'back to the future',
    'fast & furious', 'fast and the furious', 'john wick', 'spider-man', 'the avengers',
    'avengers', 'dune', 'batman', 'shrek', 'despicable me', 'the hunger games',
    'hunger games', 'blade runner', 'planet of the apes', 'rocky', 'creed', 'bourne',
    'transformers', 'mad max', 'scream', 'halloween', 'die hard', 'avatar',
    'twilight', 'ice age', 'how to train your dragon', 'kung fu panda', 'the incredibles',
    'incredibles', 'cars', 'knives out', 'deadpool', 'guardians of the galaxy', 'thor',
    'captain america', 'iron man', 'x-men', 'terminator', 'predator', 'ghostbusters',
    'jumanji', 'rambo', "ocean's", 'the conjuring', 'conjuring', 'saw', 'evil dead',
    'a quiet place', 'godzilla', 'monsterverse', 'top gun', 'bad boys', 'lethal weapon',
    'beverly hills cop', 'men in black', 'monsters, inc.', 'finding nemo', 'paddington',
    'kingsman', 'wolverine', 'spider-verse', 'middle earth', 'dc extended universe',
    'national treasure', 'percy jackson', 'maze runner', 'divergent', 'the chronicles of narnia',
    'blade', 'robocop', 'austin powers', 'the hangover', 'final destination', 'insidious',
    'the purge', 'paranormal activity', 'rush hour'
]

ADULT_KEYWORDS = [
    'sex files', 'femalien', 'erotic', 'porn', 'xxx', 'erotica', 'sensual',
    'playboy', 'penthouse', 'lust', 'seduction', 'softcore', 'nude', 'poscoito'
]

def load_cache():
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load cache ({e}), starting fresh.")
    return {}

def save_cache(cache):
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache, f)
    except Exception as e:
        print(f"Warning: Failed to save cache: {e}")

def fetch_collection(cid):
    url = f"https://api.themoviedb.org/3/collection/{cid}?api_key={TMDB_API_KEY}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "TrovaCurator/1.0"})
            with urllib.request.urlopen(req, timeout=8) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {"_error": 404}
            if e.code == 429: # Rate limit
                time.sleep(1.0 + attempt)
                continue
            time.sleep(0.5)
        except Exception:
            time.sleep(0.5)
    return {"_error": "timeout"}

def is_initial_candidate(cid, parts):
    name = parts[0]["collection"]["name"].lower()
    if any(kw in name for kw in POPULAR_FRANCHISE_KEYWORDS):
        return True
    c = parts[0]["collection"]
    has_art = bool(c.get("poster_path") or c.get("backdrop_path"))
    if not has_art:
        return False
    ratings = [p.get("vote_average") for p in parts if isinstance(p.get("vote_average"), (int, float))]
    if not ratings or max(ratings) < 5.0:
        return False
    dates = [p.get("release_date") for p in parts if p.get("release_date")]
    if not dates:
        return False
    return True

def main():
    print("=" * 60)
    print("Trova Collections: Gold-Standard Curation & Enrichment")
    print("=" * 60)

    print(f"📖 Reading existing {JSON_PATH}...")
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        raw_movies = json.load(f)
    print(f"   Loaded {len(raw_movies)} movie records.")

    cols_by_id = defaultdict(list)
    for m in raw_movies:
        c = m.get("collection")
        if c and c.get("id"):
            cols_by_id[c["id"]].append(m)
    print(f"   Grouped into {len(cols_by_id)} unique collection IDs.")

    candidate_ids = [cid for cid, parts in cols_by_id.items() if is_initial_candidate(cid, parts)]
    print(f"🔍 Pre-filtered to {len(candidate_ids)} viable candidate collections.")

    cache = load_cache()
    cached_cids = set(int(k) for k in cache.keys())
    missing_cids = [cid for cid in candidate_ids if cid not in cached_cids]
    print(f"💾 Cache hit: {len(candidate_ids) - len(missing_cids)} collections.")
    print(f"🌐 Fetching {len(missing_cids)} collections from TMDB API...")

    if missing_cids:
        batch_size = 50
        done_count = 0
        total_missing = len(missing_cids)
        t_start = time.time()

        with ThreadPoolExecutor(max_workers=20) as executor:
            future_to_cid = {executor.submit(fetch_collection, cid): cid for cid in missing_cids}
            for future in as_completed(future_to_cid):
                cid = future_to_cid[future]
                try:
                    data = future.result()
                    cache[str(cid)] = data
                except Exception as e:
                    cache[str(cid)] = {"_error": str(e)}

                done_count += 1
                if done_count % batch_size == 0 or done_count == total_missing:
                    save_cache(cache)
                    elapsed = time.time() - t_start
                    rate = done_count / elapsed if elapsed > 0 else 0
                    sys.stdout.write(f"\r   Progress: {done_count}/{total_missing} ({done_count/total_missing*100:.1f}%) | {rate:.1f} req/s")
                    sys.stdout.flush()

        print("\n✅ All collection data fetched & cached.")
    else:
        print("✅ All candidates already cached!")

    print("\n⚖️  Applying Gold-Standard Curation Filters...")
    curated_collections = []
    discard_reasons = Counter_reasons = defaultdict(int)

    for cid in candidate_ids:
        data = cache.get(str(cid))
        if not data or data.get("_error"):
            discard_reasons["api_error_or_404"] += 1
            continue

        parts = data.get("parts", [])
        if len(parts) < 2:
            discard_reasons["less_than_2_parts"] += 1
            continue

        c_name = data.get("name", "")
        c_name_lower = c_name.lower()

        # Adult & softcore check
        if any(kw in c_name_lower for kw in ADULT_KEYWORDS):
            discard_reasons["adult_keyword_name"] += 1
            continue

        if any(p.get("adult") is True or p.get("softcore") is True for p in parts):
            discard_reasons["adult_flag_movie"] += 1
            continue

        # Artwork check
        has_col_art = bool(data.get("poster_path") or data.get("backdrop_path"))
        has_movie_art = any(bool(p.get("poster_path")) for p in parts)
        if not (has_col_art and has_movie_art):
            discard_reasons["missing_artwork"] += 1
            continue

        # Release date check
        valid_dates = [p.get("release_date") for p in parts if p.get("release_date")]
        if not valid_dates:
            discard_reasons["no_release_dates"] += 1
            continue

        years = []
        for d in valid_dates:
            try:
                y = int(d[:4])
                if y > 1900:
                    years.append(y)
            except ValueError:
                pass
        earliest_year = min(years) if years else 2000

        # Ratings & Vote count metrics
        vote_counts = [p.get("vote_count", 0) for p in parts if isinstance(p.get("vote_count"), int)]
        ratings = [float(p.get("vote_average", 0)) for p in parts if isinstance(p.get("vote_average"), (int, float))]
        positive_ratings = [r for r in ratings if r > 0]

        max_votes = max(vote_counts) if vote_counts else 0
        total_votes = sum(vote_counts)
        max_rating = max(ratings) if ratings else 0.0
        avg_rating = (sum(positive_ratings) / len(positive_ratings)) if positive_ratings else 0.0
        max_pop = max((float(p.get("popularity", 0.0)) for p in parts if isinstance(p.get("popularity"), (int, float))), default=0.0)

        is_flagship = any(kw in c_name_lower for kw in POPULAR_FRANCHISE_KEYWORDS)

        # Baseline quality gates
        if max_rating < 5.2 and not is_flagship:
            discard_reasons["max_rating_too_low"] += 1
            continue

        if len(parts) == 2 and avg_rating < 5.0 and not is_flagship:
            discard_reasons["duology_avg_too_low"] += 1
            continue

        # Credibility Vote Thresholds:
        # Flagship keywords always pass
        # Modern films (>= 1980):
        #   Duology: max_votes >= 50 or total_votes >= 75
        #   3+ movies: max_votes >= 35 or total_votes >= 60
        # Classic films (< 1980):
        #   max_votes >= 20 or total_votes >= 30
        passes_votes = is_flagship
        if not passes_votes:
            if earliest_year < 1980:
                if max_votes >= 20 or total_votes >= 30 or max_pop >= 5.0:
                    passes_votes = True
            elif len(parts) == 2:
                if max_votes >= 50 or total_votes >= 75 or (max_votes >= 35 and avg_rating >= 6.5):
                    passes_votes = True
            else: # 3+ films
                if max_votes >= 35 or total_votes >= 60 or (max_votes >= 25 and avg_rating >= 6.2):
                    passes_votes = True

        if not passes_votes:
            discard_reasons["insufficient_votes_credibility"] += 1
            continue

        curated_collections.append({
            "id": data["id"],
            "name": c_name,
            "poster_path": data.get("poster_path"),
            "backdrop_path": data.get("backdrop_path"),
            "parts": parts,
            "max_votes": max_votes,
            "total_votes": total_votes,
            "max_rating": max_rating,
            "avg_rating": avg_rating,
            "max_pop": max_pop,
            "earliest_year": earliest_year,
            "is_flagship": is_flagship
        })

    print(f"\n📊 Curation Filter Results:")
    print(f"   Original Candidates: {len(candidate_ids)}")
    for reason, count in sorted(discard_reasons.items(), key=lambda x: x[1], reverse=True):
        print(f"   - Discarded for {reason}: {count}")
    print(f"   🏆 Curated Collections Retained: {len(curated_collections)}")

    # Assemble movie list
    curated_movies = []
    seen_movie_ids = set()

    for col in curated_collections:
        c_info = {
            "id": col["id"],
            "name": col["name"],
            "poster_path": col["poster_path"],
            "backdrop_path": col["backdrop_path"]
        }
        for p in col["parts"]:
            mid = p.get("id")
            if not mid or mid in seen_movie_ids:
                continue
            seen_movie_ids.add(mid)

            curated_movies.append({
                "id": mid,
                "title": p.get("title") or p.get("original_title") or "Untitled",
                "collection": c_info,
                "poster_path": p.get("poster_path"),
                "release_date": p.get("release_date") or "",
                "vote_average": round(float(p.get("vote_average", 0.0)), 3),
                "vote_count": int(p.get("vote_count", 0)),
                "popularity": round(float(p.get("popularity", 0.0)), 2)
            })

    print(f"   🎬 Total Curated Movies: {len(curated_movies)}")

    # Sort collections by Bayesian weighted score for inspection
    # W = (v / (v + m)) * R + (m / (v + m)) * C
    C = 6.2 # dataset average
    m = 100 # minimum weight
    for col in curated_collections:
        v = col["total_votes"]
        r = col["avg_rating"]
        col["bayesian_score"] = (v / (v + m)) * r + (m / (v + m)) * C

    curated_collections.sort(key=lambda x: x["bayesian_score"], reverse=True)

    print("\n🌟 Top 10 Curated Franchises by Bayesian Acclaim Score:")
    for col in curated_collections[:10]:
        print(f"   1. {col['name']:35} | score: {col['bayesian_score']:.2f} | avg: {col['avg_rating']:.1f} | votes: {col['total_votes']:6} | films: {len(col['parts'])}")

    print("\n💾 Writing curated data to collection_movies.json...")
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(curated_movies, f, indent=4, ensure_ascii=False)

    new_size_mb = os.path.getsize(JSON_PATH) / (1024 * 1024)
    print(f"✅ Finished! New collection_movies.json size: {new_size_mb:.2f} MB")
    print("=" * 60)

if __name__ == "__main__":
    main()
