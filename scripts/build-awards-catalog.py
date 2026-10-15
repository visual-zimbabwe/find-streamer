#!/usr/bin/env python3
"""
Trova Prestigious Awards & Film Festivals Catalog Builder
Parses raw markdown archives from Downloads, queries TMDb for canonical IDs,
posters, backdrops, and ratings, and builds src/data/awards_catalog.json.
"""

import os
import sys
import re
import json
import time
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHIVE_MD = "/home/juwimana/Downloads/prestigious_movie_awards_archive.md"
FILM_AWARDS_MD = "/home/juwimana/Downloads/film_awards_winners.md"
CACHE_FILE = os.path.join(BASE_DIR, "scripts", ".tmdb_awards_cache.json")
OUTPUT_JSON = os.path.join(BASE_DIR, "src", "data", "awards_catalog.json")

TMDB_API_KEY = "d90e408fc05fa0c35ebbbc220515d376"

CEREMONY_METADATA = {
    "cannes": {
        "id": "cannes",
        "name": "Festival de Cannes",
        "shortName": "Cannes",
        "awardName": "Palme d'Or",
        "wikidataId": "Q179887",
        "country": "France",
        "city": "Cannes",
        "founded": 1946,
        "icon": "ribbon-outline",
        "badgeColor": "#E5A93C",
        "description": "The world's most prestigious film festival, awarding the legendary Palme d'Or on the French Riviera.",
    },
    "oscars_picture": {
        "id": "oscars_picture",
        "name": "Academy Awards – Best Picture",
        "shortName": "Oscars",
        "awardName": "Academy Award for Best Picture",
        "wikidataId": "Q102427",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 1929,
        "icon": "trophy-outline",
        "badgeColor": "#D4AF37",
        "description": "Cinema's highest commercial and artistic accolade, presented annually by the Academy of Motion Picture Arts and Sciences.",
    },
    "oscars_international": {
        "id": "oscars_international",
        "name": "Academy Awards – Best International Feature",
        "shortName": "Oscars International",
        "awardName": "Best International Feature Film",
        "wikidataId": "Q102427",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 1947,
        "icon": "globe-outline",
        "badgeColor": "#C5A059",
        "description": "Celebrating the world's greatest foreign-language cinema submitted by nations across the globe.",
    },
    "venice": {
        "id": "venice",
        "name": "Venice International Film Festival",
        "shortName": "Venice",
        "awardName": "Golden Lion (Leone d'Oro)",
        "wikidataId": "Q154590",
        "country": "Italy",
        "city": "Venice",
        "founded": 1932,
        "icon": "star-outline",
        "badgeColor": "#E0A96D",
        "description": "The oldest film festival in the world, celebrating visionary auteur cinema at the Venice Lido.",
    },
    "berlin": {
        "id": "berlin",
        "name": "Berlin International Film Festival (Berlinale)",
        "shortName": "Berlinale",
        "awardName": "Golden Bear (Goldener Bär)",
        "wikidataId": "Q154566",
        "country": "Germany",
        "city": "Berlin",
        "founded": 1951,
        "icon": "shield-outline",
        "badgeColor": "#B0BEC5",
        "description": "A politically engaged, artistically courageous festival honouring international cinema with the Golden Bear.",
    },
    "tiff": {
        "id": "tiff",
        "name": "Toronto International Film Festival (TIFF)",
        "shortName": "TIFF",
        "awardName": "People's Choice Award",
        "wikidataId": "Q738620",
        "country": "Canada",
        "city": "Toronto",
        "founded": 1976,
        "icon": "people-outline",
        "badgeColor": "#E25B5B",
        "description": "The premier North American autumn festival and the most reliable bellwether for international acclaim.",
    },
    "sundance": {
        "id": "sundance",
        "name": "Sundance Film Festival",
        "shortName": "Sundance",
        "awardName": "Grand Jury Prize",
        "wikidataId": "Q216894",
        "country": "United States",
        "city": "Park City, Utah",
        "founded": 1978,
        "icon": "sunny-outline",
        "badgeColor": "#F4B41A",
        "description": "The epicenter of independent cinema that launched American auteurs from the Coen brothers to Tarantino.",
    },
    "cesar": {
        "id": "cesar",
        "name": "César Awards (Académie des César)",
        "shortName": "César",
        "awardName": "Meilleur Film (Best Film)",
        "wikidataId": "Q174389",
        "country": "France",
        "city": "Paris",
        "founded": 1976,
        "icon": "sparkles-outline",
        "badgeColor": "#B38F4E",
        "description": "The national film award of France, recognizing the finest achievements in French filmmaking.",
    },
    "goya": {
        "id": "goya",
        "name": "Goya Awards (Premios Goya)",
        "shortName": "Goya",
        "awardName": "Mejor Película (Best Film)",
        "wikidataId": "Q240685",
        "country": "Spain",
        "city": "Madrid",
        "founded": 1987,
        "icon": "flame-outline",
        "badgeColor": "#D97706",
        "description": "Spain's most prestigious annual cinema honor presented by the Spanish Film Academy.",
    },
    "efa": {
        "id": "efa",
        "name": "European Film Awards",
        "shortName": "European Film Awards",
        "awardName": "European Film Award for Best Film",
        "wikidataId": "Q223740",
        "country": "Europe",
        "city": "Berlin / European host cities",
        "founded": 1988,
        "icon": "flag-outline",
        "badgeColor": "#3B82F6",
        "description": "Presented by the European Film Academy to recognize excellence in European cinematic achievements.",
    },
    "nyfcc": {
        "id": "nyfcc",
        "name": "New York Film Critics Circle (NYFCC)",
        "shortName": "NYFCC",
        "awardName": "Best Film",
        "wikidataId": "Q1141341",
        "country": "United States",
        "city": "New York",
        "founded": 1935,
        "icon": "newspaper-outline",
        "badgeColor": "#A855F7",
        "description": "The oldest and most respected film critics association in America, honoring visionary cinematic craft.",
    },
    "nbr": {
        "id": "nbr",
        "name": "National Board of Review (NBR)",
        "shortName": "NBR",
        "awardName": "Best Film",
        "wikidataId": "Q1134265",
        "country": "United States",
        "city": "New York",
        "founded": 1909,
        "icon": "bookmark-outline",
        "badgeColor": "#10B981",
        "description": "A historic cinematic institution dedicating over a century to celebrating the art of film.",
    },
    "aacta": {
        "id": "aacta",
        "name": "AACTA Awards (formerly AFI)",
        "shortName": "AACTA",
        "awardName": "Best Film",
        "wikidataId": "Q286695",
        "country": "Australia",
        "city": "Sydney",
        "founded": 1958,
        "icon": "diamond-outline",
        "badgeColor": "#EC4899",
        "description": "The preeminent film honors in Australia presented by the Australian Academy of Cinema and Television Arts.",
    },
    "aacta_international": {
        "id": "aacta_international",
        "name": "AACTA International Awards",
        "shortName": "AACTA International",
        "awardName": "Best Film",
        "wikidataId": "Q286695",
        "country": "Australia",
        "city": "Los Angeles / Sydney",
        "founded": 2011,
        "icon": "planet-outline",
        "badgeColor": "#8B5CF6",
        "description": "Recognizing world cinema excellence evaluated by Australian Academy screen practitioners.",
    },
    "locarno": {
        "id": "locarno",
        "name": "Locarno Film Festival",
        "shortName": "Locarno",
        "awardName": "Golden Leopard (Pardo d'Oro)",
        "wikidataId": "Q503612",
        "country": "Switzerland",
        "city": "Locarno",
        "founded": 1946,
        "icon": "paw-outline",
        "badgeColor": "#F59E0B",
        "description": "Renowned for discovering auteur masterworks and bold discoveries screened in the open air at Piazza Grande.",
    },
    "san_sebastian": {
        "id": "san_sebastian",
        "name": "San Sebastián International Film Festival",
        "shortName": "San Sebastián",
        "awardName": "Golden Shell (Concha de Oro)",
        "wikidataId": "Q214438",
        "country": "Spain",
        "city": "San Sebastián",
        "founded": 1953,
        "icon": "water-outline",
        "badgeColor": "#06B6D4",
        "description": "The most important film festival in the Spanish-speaking world, celebrating contemporary cinema on the Basque coast.",
    },
    "karlovy_vary": {
        "id": "karlovy_vary",
        "name": "Karlovy Vary International Film Festival",
        "shortName": "Karlovy Vary",
        "awardName": "Crystal Globe (Křišťálový glóbus)",
        "wikidataId": "Q329816",
        "country": "Czech Republic",
        "city": "Karlovy Vary",
        "founded": 1946,
        "icon": "prism-outline",
        "badgeColor": "#14B8A6",
        "description": "The leading festival in Central and Eastern Europe with a passionate audience and rich cinematic history.",
    },
    "rotterdam": {
        "id": "rotterdam",
        "name": "International Film Festival Rotterdam (IFFR)",
        "shortName": "IFFR Rotterdam",
        "awardName": "Tiger Award",
        "wikidataId": "Q630737",
        "country": "Netherlands",
        "city": "Rotterdam",
        "founded": 1972,
        "icon": "flash-outline",
        "badgeColor": "#EF4444",
        "description": "A champion of innovative, independent, and boundary-pushing cinema that honors daring emerging filmmakers.",
    },
    "tokyo": {
        "id": "tokyo",
        "name": "Tokyo International Film Festival (TIFF)",
        "shortName": "Tokyo",
        "awardName": "Tokyo Grand Prix",
        "wikidataId": "Q1056157",
        "country": "Japan",
        "city": "Tokyo",
        "founded": 1985,
        "icon": "flower-outline",
        "badgeColor": "#F43F5E",
        "description": "One of Asia's most competitive film festivals, spotlighting diverse voices from across Asia and the world.",
    },
    "mar_del_plata": {
        "id": "mar_del_plata",
        "name": "Mar del Plata International Film Festival",
        "shortName": "Mar del Plata",
        "awardName": "Golden Astor (Astor de Oro)",
        "wikidataId": "Q1892186",
        "country": "Argentina",
        "city": "Mar del Plata",
        "founded": 1954,
        "icon": "boat-outline",
        "badgeColor": "#6366F1",
        "description": "The only competitive feature festival in Latin America recognized by FIAPF with Category A status.",
    },
    "iffi": {
        "id": "iffi",
        "name": "International Film Festival of India (IFFI)",
        "shortName": "IFFI Goa",
        "awardName": "Golden Peacock (Best Film)",
        "wikidataId": "Q1666497",
        "country": "India",
        "city": "Goa",
        "founded": 1952,
        "icon": "color-palette-outline",
        "badgeColor": "#F97316",
        "description": "One of the oldest film festivals in Asia, providing a common platform for cinema cultures worldwide.",
    },
    "shanghai": {
        "id": "shanghai",
        "name": "Shanghai International Film Festival (SIFF)",
        "shortName": "Shanghai",
        "awardName": "Golden Goblet Award",
        "wikidataId": "Q1192804",
        "country": "China",
        "city": "Shanghai",
        "founded": 1993,
        "icon": "wine-outline",
        "badgeColor": "#E11D48",
        "description": "The largest international film festival in China, showcasing the best of Asian and world cinema.",
    },
}

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_cache(cache):
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving cache: {e}")

def normalize_title(title):
    t = re.sub(r'[*_]', '', str(title or '')).strip()
    t = re.sub(r'^(The|A|An)\s+', '', t, flags=re.I)
    t = re.sub(r'[^\w\s]', '', t)
    return ' '.join(t.lower().split())

def clean_title_and_orig(raw):
    raw = raw.strip('*_ ')
    # Check for (Original Title) or (US Title)
    m = re.match(r'^(.*?)\s*\((.*?)\)$', raw)
    if m:
        c1 = m.group(1).strip('*_ ')
        c2 = m.group(2).strip('*_ ')
        # Check if c2 is an annotation
        if not re.search(r'^(?:Best|a\.k\.a\.|Meilleur|Film|nominate|won|produc)', c2, re.I):
            return c1, c2
        return c1, ''
    return raw, ''

def split_titles(text):
    text = text.strip('*_ ')
    parts = []
    current = []
    depth = 0
    for char in text:
        if char == '(':
            depth += 1
            current.append(char)
        elif char == ')':
            depth = max(0, depth - 1)
            current.append(char)
        elif char == ',' and depth == 0:
            parts.append(''.join(current).strip())
            current = []
        else:
            current.append(char)
    if current:
        parts.append(''.join(current).strip())
    return [p for p in parts if p]

def search_tmdb(query, year=None):
    if not query:
        return []
    clean_q = urllib.parse.quote(query)
    url = f"https://api.themoviedb.org/3/search/movie?api_key={TMDB_API_KEY}&query={clean_q}"
    if year:
        url += f"&year={year}"
    req = urllib.request.Request(url, headers={"User-Agent": "Trova/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("results", [])
    except Exception as e:
        return []

def resolve_tmdb_item(title, orig_title, year, director, cache):
    cache_key = f"{title.lower()}::{orig_title.lower()}::{year}::{director.lower()}"
    if cache_key in cache:
        return cache[cache_key]

    year_int = None
    try:
        year_int = int(year) if year else None
    except ValueError:
        pass

    candidates = []

    # 1. Try search with title and year
    if year_int:
        candidates = search_tmdb(title, year_int)
        # 2. Try year - 1 (very common for festivals/Oscars honoring previous year)
        if not candidates:
            candidates = search_tmdb(title, year_int - 1)

    # 3. Try with original title if present
    if not candidates and orig_title:
        if year_int:
            candidates = search_tmdb(orig_title, year_int)
            if not candidates:
                candidates = search_tmdb(orig_title, year_int - 1)
        if not candidates:
            candidates = search_tmdb(orig_title)

    # 4. Try without year
    if not candidates:
        candidates = search_tmdb(title)

    if not candidates:
        cache[cache_key] = None
        return None

    # Pick the best candidate
    norm_title = normalize_title(title)
    norm_orig = normalize_title(orig_title) if orig_title else ''

    best = None
    best_score = -1

    for c in candidates[:6]:
        score = 0
        c_title = c.get("title", "")
        c_orig = c.get("original_title", "")
        c_norm_title = normalize_title(c_title)
        c_norm_orig = normalize_title(c_orig)

        # Title match
        if c_norm_title == norm_title or (norm_orig and c_norm_orig == norm_orig):
            score += 50
        elif norm_title in c_norm_title or (norm_orig and norm_orig in c_norm_orig):
            score += 25

        # Year match
        rel_date = c.get("release_date", "")
        if rel_date and year_int:
            try:
                c_year = int(rel_date[:4])
                diff = abs(c_year - year_int)
                if diff == 0:
                    score += 40
                elif diff == 1:
                    score += 30
                elif diff <= 2:
                    score += 15
                elif diff > 5:
                    score -= 30
            except ValueError:
                pass

        # Poster bonus
        if c.get("poster_path"):
            score += 10

        # Popularity bonus
        pop = c.get("popularity", 0)
        score += min(15, pop / 5)

        if score > best_score:
            best_score = score
            best = c

    if not best or best_score < 30:
        cache[cache_key] = None
        return None

    poster_path = best.get("poster_path")
    backdrop_path = best.get("backdrop_path")
    vote_avg = round(best.get("vote_average", 0), 2)
    vote_count = best.get("vote_count", 0)
    rel_date = best.get("release_date", "")
    rel_year = rel_date[:4] if len(rel_date) >= 4 else str(year or "")

    result = {
        "id": best["id"],
        "tmdbId": best["id"],
        "mediaType": "movie",
        "title": best.get("title") or title,
        "originalTitle": best.get("original_title") or orig_title or title,
        "year": rel_year,
        "posterUrl": f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None,
        "backdropUrl": f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else None,
        "rating": f"{round(vote_avg, 1)}/10" if vote_avg > 0 else "NR",
        "ratingValue": vote_avg,
        "voteCount": vote_count,
        "overview": best.get("overview", ""),
        "releaseDate": rel_date,
    }

    cache[cache_key] = result
    return result

def parse_all_awards():
    items_by_ceremony = {k: [] for k in CEREMONY_METADATA}

    # 1. Parse film_awards_winners.md first (clean single-film rows)
    if os.path.exists(FILM_AWARDS_MD):
        with open(FILM_AWARDS_MD, "r", encoding="utf-8") as f:
            text = f.read()

        # NYFCC
        m = re.search(r'## 1\. New York Film Critics Circle Award.*?(\| Year \|.+?\n\n)', text, re.DOTALL)
        if m:
            lines = [l for l in m.group(1).strip().split('\n') if l.strip().startswith('|')][2:]
            for l in lines:
                p = [x.strip() for x in l.strip('|').split('|')]
                if len(p) >= 3:
                    year, title_raw, dir_raw = p[0], p[1], p[2]
                    en, orig = clean_title_and_orig(title_raw)
                    items_by_ceremony["nyfcc"].append({
                        "year": year,
                        "award": "Best Film",
                        "position": 1,
                        "title": en,
                        "origTitle": orig,
                        "director": dir_raw,
                    })

        # CANNES from film_awards_winners
        m = re.search(r'## 2\. Festival de Cannes.*?(\| Year \|.+?\n\n)', text, re.DOTALL)
        if m:
            lines = [l for l in m.group(1).strip().split('\n') if l.strip().startswith('|')][2:]
            for l in lines:
                p = [x.strip() for x in l.strip('|').split('|')]
                if len(p) >= 3:
                    year, title_raw, dir_raw = p[0], p[1], p[2]
                    en, orig = clean_title_and_orig(title_raw)
                    items_by_ceremony["cannes"].append({
                        "year": year,
                        "award": "Palme d'Or",
                        "position": 1,
                        "title": en,
                        "origTitle": orig,
                        "director": dir_raw,
                    })

        # NBR
        m = re.search(r'## 3\. National Board of Review.*?(\| Year \|.+?\n\n)', text, re.DOTALL)
        if m:
            lines = [l for l in m.group(1).strip().split('\n') if l.strip().startswith('|')][2:]
            for l in lines:
                p = [x.strip() for x in l.strip('|').split('|')]
                if len(p) >= 3:
                    year, title_raw, dir_raw = p[0], p[1], p[2]
                    en, orig = clean_title_and_orig(title_raw)
                    items_by_ceremony["nbr"].append({
                        "year": year,
                        "award": "Best Film",
                        "position": 1,
                        "title": en,
                        "origTitle": orig,
                        "director": dir_raw,
                    })

        # AACTA
        m = re.search(r'### AACTA Award for Best Film.*?(\| Year \|.+?\n\n)', text, re.DOTALL)
        if m:
            lines = [l for l in m.group(1).strip().split('\n') if l.strip().startswith('|')][2:]
            for l in lines:
                p = [x.strip() for x in l.strip('|').split('|')]
                if len(p) >= 3:
                    year, title_raw, dir_raw = p[0], p[1], p[2]
                    en, orig = clean_title_and_orig(title_raw)
                    items_by_ceremony["aacta"].append({
                        "year": year,
                        "award": "Best Film",
                        "position": 1,
                        "title": en,
                        "origTitle": orig,
                        "director": dir_raw,
                    })

        # AACTA International
        m = re.search(r'## AACTA International Award for Best Film.*?(\| Year \|.+?\n\n)', text, re.DOTALL)
        if m:
            lines = [l for l in m.group(1).strip().split('\n') if l.strip().startswith('|')][2:]
            for l in lines:
                p = [x.strip() for x in l.strip('|').split('|')]
                if len(p) >= 3:
                    year, title_raw, dir_raw = p[0], p[1], p[2]
                    en, orig = clean_title_and_orig(title_raw)
                    items_by_ceremony["aacta_international"].append({
                        "year": year,
                        "award": "Best Film",
                        "position": 1,
                        "title": en,
                        "origTitle": orig,
                        "director": dir_raw,
                    })

        # GOYA
        m = re.search(r'## 5\. Goya Awards.*?(\| Ceremony Year.*?\|.+?\n\n)', text, re.DOTALL)
        if m:
            lines = [l for l in m.group(1).strip().split('\n') if l.strip().startswith('|')][2:]
            for l in lines:
                p = [x.strip() for x in l.strip('|').split('|')]
                if len(p) >= 4:
                    ceremony_year = re.search(r'\d{4}', p[0])
                    rel_year = p[1].strip()
                    year = rel_year if rel_year else (ceremony_year.group(0) if ceremony_year else "")
                    title_raw = p[2]
                    dir_raw = p[3]
                    en, orig = clean_title_and_orig(title_raw)
                    items_by_ceremony["goya"].append({
                        "year": year,
                        "award": "Premio Goya a la Mejor Película",
                        "position": 1,
                        "title": en,
                        "origTitle": orig,
                        "director": dir_raw,
                    })

    # 2. Parse prestigious_movie_awards_archive.md
    if os.path.exists(ARCHIVE_MD):
        with open(ARCHIVE_MD, "r", encoding="utf-8") as f:
            text = f.read()

        sections = re.findall(r'### ([^\n]+)\n\n(\|.+?\n\n)', text, re.DOTALL)
        for s_title, table in sections:
            lines = [l for l in table.strip().split('\n') if l.strip().startswith('|')][2:]

            # Map section title to ceremony key
            c_key = None
            if "Oscars) – Best Picture" in s_title:
                c_key = "oscars_picture"
            elif "Oscars) – Best International" in s_title:
                c_key = "oscars_international"
            elif "Venice" in s_title:
                c_key = "venice"
            elif "Berlin" in s_title:
                c_key = "berlin"
            elif "Toronto" in s_title:
                c_key = "tiff"
            elif "Sundance" in s_title:
                c_key = "sundance"
            elif "César" in s_title:
                c_key = "cesar"
            elif "European Film Awards" in s_title:
                c_key = "efa"
            elif "Locarno" in s_title:
                c_key = "locarno"
            elif "San Sebastián" in s_title:
                c_key = "san_sebastian"
            elif "Karlovy Vary" in s_title:
                c_key = "karlovy_vary"
            elif "Rotterdam" in s_title:
                c_key = "rotterdam"
            elif "Tokyo" in s_title:
                c_key = "tokyo"
            elif "Mar del Plata" in s_title:
                c_key = "mar_del_plata"
            elif "India" in s_title:
                c_key = "iffi"
            elif "Shanghai" in s_title:
                c_key = "shanghai"
            elif "Cannes" in s_title:
                # Cannes is already loaded from film_awards_winners for 1st place!
                # We can also add Grand Prix (2nd place) or Jury Prize (3rd place) from archive
                c_key = "cannes_archive"

            if not c_key:
                continue

            for l in lines:
                p = [x.strip() for x in l.strip('|').split('|')]
                if len(p) < 4:
                    continue
                year = p[0]
                pos_raw = p[1].replace('*', '').strip().lower()
                award = p[2].strip()
                title_col = p[3]
                dir_col = p[4] if len(p) > 4 else ""

                if any(skip in title_col.lower() for skip in ['no award', 'festival not held', 'not awarded', 'no official award', 'festival cancelled', 'tie occurred']):
                    continue

                pos = 1
                if '2nd' in pos_raw or 'runner' in pos_raw:
                    pos = 2
                elif '3rd' in pos_raw:
                    pos = 3

                # Ceremony-specific parsing
                if c_key == "oscars_picture":
                    en, orig = clean_title_and_orig(title_col)
                    items_by_ceremony["oscars_picture"].append({
                        "year": year,
                        "award": award,
                        "position": pos,
                        "title": en,
                        "origTitle": orig,
                        "director": dir_col,
                    })

                elif c_key == "oscars_international":
                    # Winner is the first title
                    raw = title_col.strip('*_ ')
                    if year == "1955":
                        winner_title = "Samurai, The Legend of Musashi"
                    else:
                        winner_title = raw.split(',')[0].strip()
                    en, orig = clean_title_and_orig(winner_title)
                    first_dir = dir_col.split(',')[0].strip() if dir_col else ""
                    items_by_ceremony["oscars_international"].append({
                        "year": year,
                        "award": award,
                        "position": 1,
                        "title": en,
                        "origTitle": orig,
                        "director": first_dir,
                    })

                elif c_key == "cesar":
                    raw = title_col.strip('*_ ')
                    # In 1984, tie between The Ball and To Our Love
                    if year == "1984":
                        winner_titles = ["The Ball", "To Our Love"]
                    else:
                        winner_titles = [raw.split(',')[0].strip()]
                    for wt in winner_titles:
                        en, orig = clean_title_and_orig(wt)
                        items_by_ceremony["cesar"].append({
                            "year": year,
                            "award": award,
                            "position": 1,
                            "title": en,
                            "origTitle": orig,
                            "director": dir_col.split(',')[0].strip() if dir_col else "",
                        })

                elif c_key == "efa":
                    raw = title_col.strip('*_ ')
                    winner_title = raw.split(',')[0].strip()
                    en, orig = clean_title_and_orig(winner_title)
                    items_by_ceremony["efa"].append({
                        "year": year,
                        "award": award,
                        "position": 1,
                        "title": en,
                        "origTitle": orig,
                        "director": dir_col.split(',')[0].strip() if dir_col else "",
                    })

                elif c_key == "mar_del_plata":
                    raw = title_col.strip('*_ ')
                    winner_title = raw.split(', Best Film:')[0].split(',')[0].strip()
                    en, orig = clean_title_and_orig(winner_title)
                    items_by_ceremony["mar_del_plata"].append({
                        "year": year,
                        "award": award,
                        "position": 1,
                        "title": en,
                        "origTitle": orig,
                        "director": dir_col,
                    })

                elif c_key == "tokyo":
                    raw = title_col.strip('*_ ')
                    # In Tokyo, title and director are in col 3, e.g. "Typhoon Club Shinji Sōmai"
                    # Often the director is the last 2 words
                    words = raw.split()
                    if len(words) > 2:
                        dir_guess = " ".join(words[-2:])
                        title_guess = " ".join(words[:-2])
                    else:
                        dir_guess = ""
                        title_guess = raw
                    en, orig = clean_title_and_orig(title_guess)
                    items_by_ceremony["tokyo"].append({
                        "year": year,
                        "award": award,
                        "position": pos,
                        "title": en,
                        "origTitle": orig,
                        "director": dir_guess,
                    })

                elif c_key == "rotterdam":
                    # Tiger award winners
                    raw = title_col.strip('*_ ')
                    for t in split_titles(raw):
                        en, orig = clean_title_and_orig(t)
                        items_by_ceremony["rotterdam"].append({
                            "year": year,
                            "award": award,
                            "position": 1,
                            "title": en,
                            "origTitle": orig,
                            "director": dir_col,
                        })

                elif c_key == "cannes_archive":
                    # Add 2nd Place (Grand Prix) and 3rd Place (Prix du Jury) to Cannes
                    if pos in (2, 3):
                        raw = title_col.strip('*_ ')
                        for t in split_titles(raw):
                            en, orig = clean_title_and_orig(t)
                            items_by_ceremony["cannes"].append({
                                "year": year,
                                "award": award,
                                "position": pos,
                                "title": en,
                                "origTitle": orig,
                                "director": dir_col,
                            })

                else:
                    # General festival (Venice, Berlin, TIFF, Sundance, Locarno, San Sebastián, Karlovy Vary, IFFI, Shanghai)
                    raw = title_col.strip('*_ ')
                    titles_list = split_titles(raw)
                    for t in titles_list:
                        en, orig = clean_title_and_orig(t)
                        items_by_ceremony[c_key].append({
                            "year": year,
                            "award": award,
                            "position": pos,
                            "title": en,
                            "origTitle": orig,
                            "director": dir_col,
                        })

    return items_by_ceremony

def main():
    print("Building Trova Prestigious Awards & Film Festivals Catalog...")
    cache = load_cache()
    print(f"Loaded {len(cache)} entries from cache.")

    parsed = parse_all_awards()
    total_awards = sum(len(items) for items in parsed.values())
    print(f"Parsed {len(parsed)} ceremonies with {total_awards} total award entries.")

    # Collect unique queries to resolve
    queries_to_resolve = {}
    for c_key, items in parsed.items():
        for it in items:
            key = (it["title"], it.get("origTitle", ""), it["year"], it.get("director", ""))
            if key not in queries_to_resolve:
                queries_to_resolve[key] = []
            queries_to_resolve[key].append((c_key, it))

    print(f"Total unique film queries to resolve: {len(queries_to_resolve)}")

    # Worker function for threading
    resolved_count = 0
    start_time = time.time()

    def process_query(item_tuple):
        nonlocal resolved_count
        title, orig, year, director = item_tuple
        res = resolve_tmdb_item(title, orig, year, director, cache)
        resolved_count += 1
        if resolved_count % 50 == 0:
            print(f"Resolved {resolved_count}/{len(queries_to_resolve)} ({round(time.time() - start_time, 1)}s)...")
            save_cache(cache)
        return item_tuple, res

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(process_query, q) for q in queries_to_resolve.keys()]
        for future in as_completed(futures):
            future.result()

    save_cache(cache)
    print(f"Completed TMDb resolution in {round(time.time() - start_time, 1)}s. Cache saved.")

    # Assemble final output
    ceremonies_output = []
    all_winners_map = {}

    for c_key, meta in CEREMONY_METADATA.items():
        items = parsed.get(c_key, [])
        winners_list = []
        seen_films_for_ceremony = set()

        for it in items:
            title = it["title"]
            orig = it.get("origTitle", "")
            year = it["year"]
            director = it.get("director", "")
            award_name = it["award"]
            position = it["position"]

            cache_key = f"{title.lower()}::{orig.lower()}::{year}::{director.lower()}"
            tmdb_item = cache.get(cache_key)

            if not tmdb_item:
                continue

            movie_id = tmdb_item["id"]
            # Deduplicate per ceremony & year
            ceremony_film_key = f"{movie_id}:{year}:{position}"
            if ceremony_film_key in seen_films_for_ceremony:
                continue
            seen_films_for_ceremony.add(ceremony_film_key)

            winner_record = {
                **tmdb_item,
                "awardYear": year,
                "award": award_name,
                "position": position,
                "ceremonyId": c_key,
                "ceremonyName": meta["name"],
                "director": director or tmdb_item.get("director", ""),
            }
            winners_list.append(winner_record)

            # Add to global all_winners_map
            if movie_id not in all_winners_map:
                all_winners_map[movie_id] = {
                    **tmdb_item,
                    "awards": [],
                }
            all_winners_map[movie_id]["awards"].append({
                "ceremonyId": c_key,
                "ceremonyName": meta["name"],
                "award": award_name,
                "year": year,
                "position": position,
            })

        # Sort ceremony winners descending by awardYear then position
        winners_list.sort(key=lambda x: (str(x.get("awardYear", "")), -x.get("position", 1)), reverse=True)

        ceremonies_output.append({
            **meta,
            "winnersCount": len(winners_list),
            "winners": winners_list,
        })

    # Sort ceremonies by prestige rank or defined order
    all_winners_list = list(all_winners_map.values())
    all_winners_list.sort(key=lambda x: (len(x["awards"]), x.get("ratingValue", 0)), reverse=True)

    catalog_data = {
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "totalCeremonies": len(ceremonies_output),
        "totalUniqueWinners": len(all_winners_list),
        "ceremonies": ceremonies_output,
        "allWinners": all_winners_list,
    }

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    OUTPUT_JS = os.path.splitext(OUTPUT_JSON)[0] + ".js"
    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("export const awardsData = " + json.dumps(catalog_data, indent=2, ensure_ascii=False) + ";\nexport default awardsData;\n")

    print(f"Successfully generated {OUTPUT_JSON} and {OUTPUT_JS}!")
    print(f"Total ceremonies: {len(ceremonies_output)}")
    print(f"Total unique winning films: {len(all_winners_list)}")
    for c in ceremonies_output:
        print(f"  {c['shortName']}: {c['winnersCount']} films")

if __name__ == "__main__":
    main()
