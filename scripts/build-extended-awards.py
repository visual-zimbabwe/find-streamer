#!/usr/bin/env python3
"""
Trova Extended Awards & Festivals Catalog Ingestion
Adds 24 prestigious global film ceremonies to Trova's awards catalog:
- British Academies: BAFTA Best Film, BAFTA Outstanding British Film
- European Academies: David di Donatello (Italy), Deutscher Filmpreis (Germany),
  Guldbagge (Sweden), Bodil (Denmark)
- Asian Academies & Honors: Japan Academy, Blue Dragon (Korea), Golden Horse (Taiwan),
  Hong Kong Film Awards, National Film Awards (India)
- Latin American Academies: Premio Ariel (Mexico), Grande Prêmio do Cinema Brasileiro (Brazil)
- Global Festivals: Filmfest München (Germany), BFI London Film Festival (UK),
  Busan New Currents (Korea), Sydney Film Festival (Australia), Göteborg (Nordic),
  Sitges (Catalonia/Spain), Annecy Animation (France)
- North American Critics & Indies: LAFCA, NSFC, Film Independent Spirit Awards, Gotham Awards
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
CACHE_FILE = os.path.join(BASE_DIR, "scripts", ".tmdb_awards_cache.json")
OUTPUT_JSON = os.path.join(BASE_DIR, "src", "data", "awards_catalog.json")
OUTPUT_JS = os.path.join(BASE_DIR, "src", "data", "awards_catalog.js")

TMDB_API_KEY = "d90e408fc05fa0c35ebbbc220515d376"

EXTENDED_CEREMONY_META = {
    "bafta_film": {
        "id": "bafta_film",
        "name": "BAFTA Film Awards – Best Film",
        "shortName": "BAFTA Film",
        "awardName": "BAFTA Award for Best Film",
        "wikidataId": "Q139184",
        "country": "United Kingdom",
        "city": "London",
        "founded": 1948,
        "badgeColor": "#F59E0B",
        "description": "The British Academy of Film and Television Arts' premier international award for outstanding cinematic achievement.",
    },
    "bafta_british": {
        "id": "bafta_british",
        "name": "BAFTA Film Awards – Outstanding British Film",
        "shortName": "BAFTA British",
        "awardName": "Alexander Korda Award for Outstanding British Film",
        "wikidataId": "Q787144",
        "country": "United Kingdom",
        "city": "London",
        "founded": 1948,
        "badgeColor": "#3B82F6",
        "description": "Celebrating the most exceptional, culturally distinct, and original British filmmaking of the year.",
    },
    "david_di_donatello": {
        "id": "david_di_donatello",
        "name": "David di Donatello Awards – Miglior Film",
        "shortName": "David di Donatello",
        "awardName": "David di Donatello per il miglior film",
        "wikidataId": "Q1177309",
        "country": "Italy",
        "city": "Rome",
        "founded": 1955,
        "badgeColor": "#EAB308",
        "description": "The gold standard of Italian cinema, presented by the Accademia del Cinema Italiano celebrating legendary auteur filmmakers.",
    },
    "deutscher_filmpreis": {
        "id": "deutscher_filmpreis",
        "name": "Deutscher Filmpreis (German Film Awards)",
        "shortName": "Deutscher Filmpreis",
        "awardName": "Lola in Gold (Bester Spielfilm)",
        "wikidataId": "Q1205937",
        "country": "Germany",
        "city": "Berlin",
        "founded": 1951,
        "badgeColor": "#E11D48",
        "description": "Germany's most important and generously endowed film awards, presented annually by the Deutsche Filmakademie.",
    },
    "japan_academy": {
        "id": "japan_academy",
        "name": "Japan Academy Film Prize – Picture of the Year",
        "shortName": "Japan Academy",
        "awardName": "Picture of the Year (最優秀作品賞)",
        "wikidataId": "Q6157833",
        "country": "Japan",
        "city": "Tokyo",
        "founded": 1978,
        "badgeColor": "#EF4444",
        "description": "The preeminent cinema accolade in Japan, presented by the Nippon Academy-sho Association for cinematic excellence.",
    },
    "blue_dragon": {
        "id": "blue_dragon",
        "name": "Blue Dragon Film Awards – Best Film",
        "shortName": "Blue Dragon",
        "awardName": "Best Film (최우수 작품상)",
        "wikidataId": "Q4929068",
        "country": "South Korea",
        "city": "Seoul",
        "founded": 1963,
        "badgeColor": "#2563EB",
        "description": "South Korea's most trusted and prestigious film honors, celebrating the pinnacle of Korean cinematic artistry.",
    },
    "golden_horse": {
        "id": "golden_horse",
        "name": "Golden Horse Awards – Best Narrative Feature",
        "shortName": "Golden Horse",
        "awardName": "Best Narrative Feature (最佳劇情片)",
        "wikidataId": "Q17500588",
        "country": "Taiwan",
        "city": "Taipei",
        "founded": 1962,
        "badgeColor": "#D97706",
        "description": "Universally regarded as the Oscars of Chinese-language cinema, celebrating fearless auteur works across the Sinosphere.",
    },
    "hong_kong_awards": {
        "id": "hong_kong_awards",
        "name": "Hong Kong Film Awards – Best Film",
        "shortName": "Hong Kong Awards",
        "awardName": "Best Film (最佳電影)",
        "wikidataId": "Q5895089",
        "country": "Hong Kong",
        "city": "Hong Kong",
        "founded": 1982,
        "badgeColor": "#DC2626",
        "description": "The premier film honours in Hong Kong, commemorating landmark classics of martial arts, noir thriller, and auteur cinema.",
    },
    "ariel": {
        "id": "ariel",
        "name": "Premio Ariel – Mejor Película",
        "shortName": "Ariel Awards",
        "awardName": "Ariel de Oro a la Mejor Película",
        "wikidataId": "Q1754020",
        "country": "Mexico",
        "city": "Mexico City",
        "founded": 1946,
        "badgeColor": "#059669",
        "description": "The Mexican Academy of Film Arts and Sciences' ultimate tribute to national cinema masterworks.",
    },
    "guldbagge": {
        "id": "guldbagge",
        "name": "Guldbagge Awards – Bästa Film",
        "shortName": "Guldbagge",
        "awardName": "Guldbagge för bästa film",
        "wikidataId": "Q889392",
        "country": "Sweden",
        "city": "Stockholm",
        "founded": 1964,
        "badgeColor": "#FBBF24",
        "description": "Sweden's foremost film prize, presented by the Swedish Film Institute for extraordinary cinematic artistry.",
    },
    "bodil": {
        "id": "bodil",
        "name": "Bodil Awards – Best Danish Film",
        "shortName": "Bodil Awards",
        "awardName": "Bodilprisen for bedste danske film",
        "wikidataId": "Q889883",
        "country": "Denmark",
        "city": "Copenhagen",
        "founded": 1948,
        "badgeColor": "#BE185D",
        "description": "One of Europe's oldest critics' film awards, presented by Danish Film Critics honoring bold Danish auteur works.",
    },
    "brazilian_cinema": {
        "id": "brazilian_cinema",
        "name": "Grande Prêmio do Cinema Brasileiro",
        "shortName": "Cinema Brasileiro",
        "awardName": "Melhor Longa-Metragem de Ficção",
        "wikidataId": "Q10291410",
        "country": "Brazil",
        "city": "Rio de Janeiro",
        "founded": 2002,
        "badgeColor": "#10B981",
        "description": "Brazil's official national film honours, presented by the Brazilian Academy of Cinema for contemporary masterpieces.",
    },
    "filmfest_munchen": {
        "id": "filmfest_munchen",
        "name": "Filmfest München (Munich International Film Festival)",
        "shortName": "Filmfest München",
        "awardName": "ARRI / CineCoPro & CineMerit Award",
        "wikidataId": "Q315284",
        "country": "Germany",
        "city": "Munich",
        "founded": 1983,
        "badgeColor": "#8B5CF6",
        "description": "Germany's major summer festival, celebrated for championing international co-productions and visionary world cinema.",
    },
    "london_film_fest": {
        "id": "london_film_fest",
        "name": "BFI London Film Festival",
        "shortName": "London Film Fest",
        "awardName": "Best Film Award (Official Competition)",
        "wikidataId": "Q6670414",
        "country": "United Kingdom",
        "city": "London",
        "founded": 1957,
        "badgeColor": "#6366F1",
        "description": "The flagship competitive showcase of the British Film Institute, honouring cinema that is imaginative, inventive and audacious.",
    },
    "busan_new_currents": {
        "id": "busan_new_currents",
        "name": "Busan International Film Festival (BIFF)",
        "shortName": "Busan (New Currents)",
        "awardName": "New Currents Award",
        "wikidataId": "Q12597750",
        "country": "South Korea",
        "city": "Busan",
        "founded": 1996,
        "badgeColor": "#EC4899",
        "description": "Asia's premier festival competition, recognizing trailblazing debut and sophomore features by emerging Asian filmmakers.",
    },
    "sydney_film_fest": {
        "id": "sydney_film_fest",
        "name": "Sydney Film Festival",
        "shortName": "Sydney Film Prize",
        "awardName": "Sydney Film Prize",
        "wikidataId": "Q24190861",
        "country": "Australia",
        "city": "Sydney",
        "founded": 1954,
        "badgeColor": "#14B8A6",
        "description": "Presented to the most audacious and courageous feature film in official competition at Australia's flagship festival.",
    },
    "goteborg": {
        "id": "goteborg",
        "name": "Göteborg Film Festival",
        "shortName": "Göteborg",
        "awardName": "Dragon Award for Best Nordic Film",
        "wikidataId": "Q10476839",
        "country": "Sweden",
        "city": "Gothenburg",
        "founded": 1979,
        "badgeColor": "#0284C7",
        "description": "The largest festival in Scandinavia and the Nordic region, presenting the coveted Dragon Award for Nordic cinema.",
    },
    "sitges": {
        "id": "sitges",
        "name": "Sitges Film Festival",
        "shortName": "Sitges",
        "awardName": "Best Feature Film (Premi al Millor Pel·lícula)",
        "wikidataId": "Q11942858",
        "country": "Spain",
        "city": "Sitges",
        "founded": 1968,
        "badgeColor": "#9333EA",
        "description": "The world's foremost festival for fantasy, sci-fi, horror and cult cinema, hosted on the scenic Catalan coast.",
    },
    "annecy_animation": {
        "id": "annecy_animation",
        "name": "Annecy International Animated Film Festival",
        "shortName": "Annecy Animation",
        "awardName": "Cristal du long métrage (Best Feature)",
        "wikidataId": "Q3002821",
        "country": "France",
        "city": "Annecy",
        "founded": 1960,
        "badgeColor": "#F97316",
        "description": "The global pinnacle of animated cinema, presenting the Cristal to the world's most breathtaking animated achievements.",
    },
    "lafca": {
        "id": "lafca",
        "name": "Los Angeles Film Critics Association (LAFCA)",
        "shortName": "LAFCA",
        "awardName": "Best Film",
        "wikidataId": "Q1139414",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 1975,
        "badgeColor": "#D97706",
        "description": "A cornerstone of film criticism that honors visionary American and international works with lasting cinematic power.",
    },
    "nsfc": {
        "id": "nsfc",
        "name": "National Society of Film Critics (NSFC)",
        "shortName": "NSFC",
        "awardName": "Best Picture",
        "wikidataId": "Q1437877",
        "country": "United States",
        "city": "New York",
        "founded": 1966,
        "badgeColor": "#0D9488",
        "description": "The most erudite critics body in North America, consistently championing bold auteur visions over commercial consensus.",
    },
    "spirit_awards": {
        "id": "spirit_awards",
        "name": "Film Independent Spirit Awards",
        "shortName": "Spirit Awards",
        "awardName": "Best Feature",
        "wikidataId": "Q1112462",
        "country": "United States",
        "city": "Santa Monica",
        "founded": 1984,
        "badgeColor": "#4F46E5",
        "description": "The premier celebration of independent film, honoring visionary creators working outside the studio ecosystem.",
    },
    "gotham_awards": {
        "id": "gotham_awards",
        "name": "Gotham Independent Film Awards",
        "shortName": "Gotham Awards",
        "awardName": "Best Feature",
        "wikidataId": "Q1538781",
        "country": "United States",
        "city": "New York",
        "founded": 1991,
        "badgeColor": "#0891B2",
        "description": "The iconic kickoff of awards season, spotlighting innovative, groundbreaking independent storytelling.",
    },
    "national_film_awards_india": {
        "id": "national_film_awards_india",
        "name": "National Film Awards (India)",
        "shortName": "National Film Awards",
        "awardName": "Golden Lotus (Swarna Kamal) for Best Feature Film",
        "wikidataId": "Q3536894",
        "country": "India",
        "city": "New Delhi",
        "founded": 1954,
        "badgeColor": "#EA580C",
        "description": "India's highest national cinema honor, evaluating artistic masterworks across all linguistic traditions of the subcontinent.",
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
    except Exception:
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
    if year_int:
        candidates = search_tmdb(title, year_int)
        if not candidates:
            candidates = search_tmdb(title, year_int - 1)
        if not candidates:
            candidates = search_tmdb(title, year_int + 1)

    if not candidates and orig_title:
        if year_int:
            candidates = search_tmdb(orig_title, year_int)
            if not candidates:
                candidates = search_tmdb(orig_title, year_int - 1)
        if not candidates:
            candidates = search_tmdb(orig_title)

    if not candidates:
        candidates = search_tmdb(title)

    if not candidates:
        cache[cache_key] = None
        return None

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

        if c_norm_title == norm_title or (norm_orig and c_norm_orig == norm_orig):
            score += 50
        elif norm_title in c_norm_title or (norm_orig and norm_orig in c_norm_orig):
            score += 25

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

        if c.get("poster_path"):
            score += 10
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
        "originalLanguage": best.get("original_language", ""),
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

NEW_CEREMONY_WINNERS = {
    "bafta_film": [
        ("2024", "Oppenheimer", "", "Christopher Nolan"),
        ("2023", "All Quiet on the Western Front", "Im Westen nichts Neues", "Edward Berger"),
        ("2022", "The Power of the Dog", "", "Jane Campion"),
        ("2021", "Nomadland", "", "Chloé Zhao"),
        ("2020", "1917", "", "Sam Mendes"),
        ("2019", "Roma", "", "Alfonso Cuarón"),
        ("2018", "Three Billboards Outside Ebbing, Missouri", "", "Martin McDonagh"),
        ("2017", "La La Land", "", "Damien Chazelle"),
        ("2016", "The Revenant", "", "Alejandro G. Iñárritu"),
        ("2015", "Boyhood", "", "Richard Linklater"),
        ("2014", "12 Years a Slave", "", "Steve McQueen"),
        ("2013", "Argo", "", "Ben Affleck"),
        ("2012", "The Artist", "", "Michel Hazanavicius"),
        ("2011", "The King's Speech", "", "Tom Hooper"),
        ("2010", "The Hurt Locker", "", "Kathryn Bigelow"),
        ("2009", "Slumdog Millionaire", "", "Danny Boyle"),
        ("2008", "Atonement", "", "Joe Wright"),
        ("2007", "The Queen", "", "Stephen Frears"),
        ("2006", "Brokeback Mountain", "", "Ang Lee"),
        ("2005", "The Aviator", "", "Martin Scorsese"),
        ("2004", "The Lord of the Rings: The Return of the King", "", "Peter Jackson"),
        ("2003", "The Pianist", "", "Roman Polanski"),
        ("2002", "The Lord of the Rings: The Fellowship of the Ring", "", "Peter Jackson"),
        ("2001", "Gladiator", "", "Ridley Scott"),
        ("2000", "American Beauty", "", "Sam Mendes"),
        ("1999", "Shakespeare in Love", "", "John Madden"),
        ("1998", "The English Patient", "", "Anthony Minghella"),
        ("1997", "Secrets & Lies", "", "Mike Leigh"),
        ("1996", "Sense and Sensibility", "", "Ang Lee"),
        ("1995", "Four Weddings and a Funeral", "", "Mike Newell"),
        ("1994", "Schindler's List", "", "Steven Spielberg"),
        ("1993", "Howards End", "", "James Ivory"),
        ("1992", "The Commitments", "", "Alan Parker"),
        ("1991", "Goodfellas", "", "Martin Scorsese"),
        ("1990", "Dead Poets Society", "", "Peter Weir"),
        ("1989", "The Last Emperor", "", "Bernardo Bertolucci"),
        ("1988", "Jean de Florette", "", "Claude Berri"),
        ("1987", "A Room with a View", "", "James Ivory"),
        ("1986", "The Purple Rose of Cairo", "", "Woody Allen"),
        ("1985", "The Killing Fields", "", "Roland Joffé"),
        ("1984", "Educating Rita", "", "Lewis Gilbert"),
        ("1983", "Gandhi", "", "Richard Attenborough"),
        ("1982", "Chariots of Fire", "", "Hugh Hudson"),
        ("1981", "The Elephant Man", "", "David Lynch"),
        ("1980", "Manhattan", "", "Woody Allen"),
        ("1979", "Julia", "", "Fred Zinnemann"),
        ("1978", "Annie Hall", "", "Woody Allen"),
        ("1977", "One Flew Over the Cuckoo's Nest", "", "Miloš Forman"),
        ("1976", "Alice Doesn't Live Here Anymore", "", "Martin Scorsese"),
        ("1975", "Lacombe, Lucien", "", "Louis Malle"),
        ("1974", "Day for Night", "La Nuit américaine", "François Truffaut"),
        ("1973", "Cabaret", "", "Bob Fosse"),
        ("1972", "Sunday Bloody Sunday", "", "John Schlesinger"),
        ("1971", "Butch Cassidy and the Sundance Kid", "", "George Roy Hill"),
        ("1970", "Midnight Cowboy", "", "John Schlesinger"),
        ("1969", "The Graduate", "", "Mike Nichols"),
        ("1968", "A Man for All Seasons", "", "Fred Zinnemann"),
        ("1967", "Who's Afraid of Virginia Woolf?", "", "Mike Nichols"),
        ("1966", "My Fair Lady", "", "George Cukor"),
        ("1965", "Dr. Strangelove", "", "Stanley Kubrick"),
        ("1964", "Tom Jones", "", "Tony Richardson"),
        ("1963", "Lawrence of Arabia", "", "David Lean"),
        ("1962", "The Hustler", "", "Robert Rossen"),
        ("1961", "The Apartment", "", "Billy Wilder"),
        ("1960", "Ben-Hur", "", "William Wyler"),
        ("1958", "The Bridge on the River Kwai", "", "David Lean"),
        ("1957", "Gervaise", "", "René Clément"),
        ("1956", "Richard III", "", "Laurence Olivier"),
        ("1955", "The Wages of Fear", "Le Salaire de la peur", "Henri-Georges Clouzot"),
        ("1954", "Forbidden Games", "Jeux interdits", "René Clément"),
        ("1951", "All About Eve", "", "Joseph L. Mankiewicz"),
        ("1950", "The Bicycle Thieves", "Ladri di biciclette", "Vittorio De Sica"),
        ("1949", "Hamlet", "", "Laurence Olivier"),
        ("1948", "The Best Years of Our Lives", "", "William Wyler"),
    ],
    "bafta_british": [
        ("2024", "The Zone of Interest", "", "Jonathan Glazer"),
        ("2023", "The Banshees of Inisherin", "", "Martin McDonagh"),
        ("2022", "Belfast", "", "Kenneth Branagh"),
        ("2021", "Promising Young Woman", "", "Emerald Fennell"),
        ("2020", "1917", "", "Sam Mendes"),
        ("2019", "The Favourite", "", "Yorgos Lanthimos"),
        ("2018", "Three Billboards Outside Ebbing, Missouri", "", "Martin McDonagh"),
        ("2017", "I, Daniel Blake", "", "Ken Loach"),
        ("2016", "Brooklyn", "", "John Crowley"),
        ("2015", "The Theory of Everything", "", "James Marsh"),
        ("2014", "Gravity", "", "Alfonso Cuarón"),
        ("2013", "Skyfall", "", "Sam Mendes"),
        ("2012", "Tinker Tailor Soldier Spy", "", "Tomas Alfredson"),
        ("2011", "The King's Speech", "", "Tom Hooper"),
        ("2010", "Fish Tank", "", "Andrea Arnold"),
        ("2009", "Man on Wire", "", "James Marsh"),
        ("2008", "This Is England", "", "Shane Meadows"),
        ("2007", "The Last King of Scotland", "", "Kevin Macdonald"),
        ("2006", "Wallace & Gromit: The Curse of the Were-Rabbit", "", "Nick Park"),
        ("2004", "Touching the Void", "", "Kevin Macdonald"),
        ("2002", "Gosford Park", "", "Robert Altman"),
        ("2001", "Billy Elliot", "", "Stephen Daldry"),
        ("2000", "East Is East", "", "Damien O'Donnell"),
        ("1999", "Elizabeth", "", "Shekhar Kapur"),
        ("1998", "Nil by Mouth", "", "Gary Oldman"),
        ("1997", "Secrets & Lies", "", "Mike Leigh"),
        ("1996", "The Madness of King George", "", "Nicholas Hytner"),
        ("1995", "Shallow Grave", "", "Danny Boyle"),
        ("1994", "The Crying Game", "", "Neil Jordan"),
        ("1969", "The Third Man", "", "Carol Reed"),
    ],
    "david_di_donatello": [
        ("2024", "Io Capitano", "", "Matteo Garrone"),
        ("2023", "The Eight Mountains", "Le otto montagne", "Felix van Groeningen"),
        ("2022", "The Hand of God", "È stata la mano di Dio", "Paolo Sorrentino"),
        ("2021", "Hidden Away", "Volevo nascondermi", "Giorgio Diritti"),
        ("2020", "The Traitor", "Il traditore", "Marco Bellocchio"),
        ("2019", "Dogman", "", "Matteo Garrone"),
        ("2018", "Love and Bullets", "Ammore e malavita", "Antonio Manetti"),
        ("2017", "Like Crazy", "La pazza gioia", "Paolo Virzì"),
        ("2016", "Perfect Strangers", "Perfetti sconosciuti", "Paolo Genovese"),
        ("2015", "Black Souls", "Anime nere", "Francesco Munzi"),
        ("2014", "Human Capital", "Il capitale umano", "Paolo Virzì"),
        ("2013", "The Best Offer", "La migliore offerta", "Giuseppe Tornatore"),
        ("2012", "Caesar Must Die", "Cesare deve morire", "Paolo Taviani"),
        ("2011", "We Believed", "Noi credevamo", "Mario Martone"),
        ("2010", "The Man Who Will Come", "L'uomo che verrà", "Giorgio Diritti"),
        ("2009", "Gomorrah", "Gomorra", "Matteo Garrone"),
        ("2008", "The Girl by the Lake", "La ragazza del lago", "Andrea Molaioli"),
        ("2007", "The Unknown Woman", "La sconosciuta", "Giuseppe Tornatore"),
        ("2006", "The Caiman", "Il caimano", "Nanni Moretti"),
        ("2005", "The Consequences of Love", "Le conseguenze dell'amore", "Paolo Sorrentino"),
        ("2004", "The Best of Youth", "La meglio gioventù", "Marco Tullio Giordana"),
        ("2002", "The Profession of Arms", "Il mestiere delle armi", "Ermanno Olmi"),
        ("2001", "The Son's Room", "La stanza del figlio", "Nanni Moretti"),
        ("1998", "Life Is Beautiful", "La vita è bella", "Roberto Benigni"),
        ("1995", "The Postman", "Il Postino", "Michael Radford"),
        ("1990", "Cinema Paradiso", "Nuovo Cinema Paradiso", "Giuseppe Tornatore"),
        ("1988", "The Last Emperor", "", "Bernardo Bertolucci"),
        ("1984", "And the Ship Sails On", "E la nave va", "Federico Fellini"),
        ("1979", "The Tree of Wooden Clogs", "L'albero degli zoccoli", "Ermanno Olmi"),
        ("1974", "Amarcord", "", "Federico Fellini"),
        ("1971", "The Conformist", "Il conformista", "Bernardo Bertolucci"),
        ("1963", "The Leopard", "Il Gattopardo", "Luchino Visconti"),
        ("1960", "La Dolce Vita", "", "Federico Fellini"),
        ("1957", "Nights of Cabiria", "Le notti di Cabiria", "Federico Fellini"),
    ],
    "deutscher_filmpreis": [
        ("2024", "Dying", "Sterben", "Matthias Glasner"),
        ("2023", "The Teachers' Lounge", "Das Lehrerzimmer", "İlker Çatak"),
        ("2022", "Dear Thomas", "Lieber Thomas", "Andreas Kleinert"),
        ("2021", "I'm Your Man", "Ich bin dein Mensch", "Maria Schrader"),
        ("2020", "System Crasher", "Systemsprenger", "Nora Fingscheidt"),
        ("2019", "Gundermann", "", "Andreas Dresen"),
        ("2018", "3 Days in Quiberon", "3 Tage in Quiberon", "Emily Atef"),
        ("2017", "Toni Erdmann", "", "Maren Ade"),
        ("2016", "The People vs. Fritz Bauer", "Der Staat gegen Fritz Bauer", "Lars Kraume"),
        ("2015", "Victoria", "", "Sebastian Schipper"),
        ("2014", "Home from Home", "Die andere Heimat", "Edgar Reitz"),
        ("2013", "A Coffee in Berlin", "Oh Boy", "Jan-Ole Gerster"),
        ("2012", "Stopped on Track", "Halt auf freier Strecke", "Andreas Dresen"),
        ("2011", "Vincent Wants to Sea", "Vincent will Meer", "Ralf Huettner"),
        ("2010", "The White Ribbon", "Das weiße Band", "Michael Haneke"),
        ("2007", "Four Minutes", "Vier Minuten", "Chris Kraus"),
        ("2006", "The Lives of Others", "Das Leben der Anderen", "Florian Henckel von Donnersmarck"),
        ("2004", "Head-On", "Gegen die Wand", "Fatih Akin"),
        ("2003", "Good Bye Lenin!", "", "Wolfgang Becker"),
        ("2002", "Nowhere in Africa", "Nirgendwo in Afrika", "Caroline Link"),
        ("1999", "Run Lola Run", "Lola rennt", "Tom Tykwer"),
        ("1988", "Wings of Desire", "Der Himmel über Berlin", "Wim Wenders"),
        ("1982", "Fitzcarraldo", "", "Werner Herzog"),
        ("1979", "The Tin Drum", "Die Blechtrommel", "Volker Schlöndorff"),
        ("1978", "The Marriage of Maria Braun", "Die Ehe der Maria Braun", "Rainer Werner Fassbinder"),
        ("1973", "Aguirre, the Wrath of God", "Aguirre, der Zorn Gottes", "Werner Herzog"),
        ("1974", "Alice in the Cities", "Alice in den Städten", "Wim Wenders"),
    ],
    "japan_academy": [
        ("2024", "Godzilla Minus One", "Gojira Mainasu Wan", "Takashi Yamazaki"),
        ("2023", "A Man", "Aru Otoko", "Kei Ishikawa"),
        ("2022", "Drive My Car", "Doraibu mai kā", "Ryusuke Hamaguchi"),
        ("2021", "Midnight Swan", "", "Eiji Uchida"),
        ("2020", "The Journalist", "Shinbun Kisha", "Michihito Fujii"),
        ("2019", "Shoplifters", "Manbiki Kazoku", "Hirokazu Kore-eda"),
        ("2018", "The Third Murder", "Sandome no Satsujin", "Hirokazu Kore-eda"),
        ("2017", "Shin Godzilla", "", "Hideaki Anno"),
        ("2016", "Our Little Sister", "Umimachi Diary", "Hirokazu Kore-eda"),
        ("2015", "The Eternal Zero", "Eien no Zero", "Takashi Yamazaki"),
        ("2014", "The Great Passage", "Fune o Amu", "Yuya Ishii"),
        ("2013", "The Kirishima Thing", "Kirishima, Bukatsu Yamerutteyo", "Daihachi Yoshida"),
        ("2012", "Rebirth", "Yōkame no Semi", "Izuru Narushima"),
        ("2011", "Confessions", "Kokuhaku", "Tetsuya Nakashima"),
        ("2010", "The Unbroken", "Shizumanu Taiyō", "Setsuro Wakamatsu"),
        ("2009", "Departures", "Okuribito", "Yojiro Takita"),
        ("2008", "Tokyo Tower: Mom and Me, and Sometimes Dad", "", "Joji Matsuoka"),
        ("2007", "Hula Girls", "", "Lee Sang-il"),
        ("2006", "Always: Sunset on Third Street", "Always Sanchōme no Yūhi", "Takashi Yamazaki"),
        ("2003", "The Twilight Samurai", "Tasogare Seibei", "Yoji Yamada"),
        ("2002", "Spirited Away", "Sen to Chihiro no Kamikakushi", "Hayao Miyazaki"),
        ("1998", "Princess Mononoke", "Mononoke-hime", "Hayao Miyazaki"),
        ("1997", "Shall We Dance?", "", "Masayuki Suo"),
        ("1988", "A Taxing Woman", "Marusa no Onna", "Juzo Itami"),
        ("1984", "The Ballad of Narayama", "Narayama Bushiko", "Shohei Imamura"),
        ("1981", "Kagemusha", "", "Akira Kurosawa"),
        ("1978", "The Yellow Handkerchief", "Shiawase no Kiiroi Hankachi", "Yoji Yamada"),
    ],
    "blue_dragon": [
        ("2024", "12.12: The Day", "Seoului Bom", "Kim Sung-su"),
        ("2023", "Smugglers", "Milsu", "Ryoo Seung-wan"),
        ("2022", "Decision to Leave", "Heojil gyeolsim", "Park Chan-wook"),
        ("2021", "Escape from Mogadishu", "Mogadisyu", "Ryoo Seung-wan"),
        ("2020", "The Man Standing Next", "Namsanui bujangdeul", "Woo Min-ho"),
        ("2019", "Parasite", "Gisaengchung", "Bong Joon-ho"),
        ("2018", "1987: When the Day Comes", "", "Jang Joon-hwan"),
        ("2017", "A Taxi Driver", "Taeksi Woonjunsa", "Jang Hoon"),
        ("2016", "Inside Men", "Naebujadeul", "Woo Min-ho"),
        ("2015", "Assassination", "Amsal", "Choi Dong-hoon"),
        ("2014", "The Attorney", "Byeonhoin", "Yang Woo-suk"),
        ("2013", "Hope", "Sowon", "Lee Joon-ik"),
        ("2012", "Pieta", "", "Kim Ki-duk"),
        ("2011", "The Unjust", "Budanggeorae", "Ryoo Seung-wan"),
        ("2010", "Secret Reunion", "Uihyeongje", "Jang Hoon"),
        ("2009", "Mother", "Madeo", "Bong Joon-ho"),
        ("2008", "Forever the Moment", "Woori Saengae Choeukui Soongan", "Yim Soon-rye"),
        ("2006", "The Host", "Gwoemul", "Bong Joon-ho"),
        ("2005", "Sympathy for Lady Vengeance", "Chinjeolhan geumjassi", "Park Chan-wook"),
        ("2004", "Silmido", "", "Kang Woo-suk"),
        ("2003", "Spring, Summer, Fall, Winter... and Spring", "", "Kim Ki-duk"),
        ("2000", "Joint Security Area", "Gongdong gyeongbi guyeok JSA", "Park Chan-wook"),
        ("1998", "Christmas in August", "Palwolui Christmas", "Hur Jin-ho"),
    ],
    "golden_horse": [
        ("2024", "Old Fox", "", "Hsiao Ya-chuan"),
        ("2023", "Coo-Coo 043", "Yi jia zi fan qie", "Chan Ching-lin"),
        ("2022", "The Falls", "Pubu", "Chung Mong-hong"),
        ("2021", "Dear Tenant", "Qin ai de fang ke", "Cheng Yu-chieh"),
        ("2020", "A Sun", "Yang Guang Pu Zhao", "Chung Mong-hong"),
        ("2019", "An Elephant Sitting Still", "Da xiang xi di er zuo", "Hu Bo"),
        ("2018", "The Bold, the Corrupt, and the Beautiful", "Xue guan yin", "Ya-che Yang"),
        ("2015", "The Assassin", "Nie Yinniang", "Hou Hsiao-hsien"),
        ("2014", "Blind Massage", "Tui na", "Lou Ye"),
        ("2013", "Ilo Ilo", "Ba ma bu zai jia", "Anthony Chen"),
        ("2011", "Warriors of the Rainbow: Seediq Bale", "Saideke balai", "Wei Te-sheng"),
        ("2007", "Lust, Caution", "Se, Jie", "Ang Lee"),
        ("2003", "Infernal Affairs", "Mou gaan dou", "Andrew Lau"),
        ("2000", "Crouching Tiger, Hidden Dragon", "Wo hu cang long", "Ang Lee"),
        ("1996", "Comrades: Almost a Love Story", "Tian mi mi", "Peter Chan"),
        ("1994", "Vive L'Amour", "Ai qing wan sui", "Tsai Ming-liang"),
        ("1993", "The Wedding Banquet", "Xi yan", "Ang Lee"),
        ("1991", "A Brighter Summer Day", "Guling jie shaonian sharen shijian", "Edward Yang"),
        ("1989", "A City of Sadness", "Beiqing chengshi", "Hou Hsiao-hsien"),
        ("1986", "The Terrorizers", "Kongbu fenzi", "Edward Yang"),
        ("1971", "A Touch of Zen", "Xia nü", "King Hu"),
    ],
    "hong_kong_awards": [
        ("2024", "A Guilty Conscience", "Duk sit dai lo", "Jack Ng"),
        ("2023", "To My Nineteen Year Old Self", "", "Mabel Cheung"),
        ("2022", "Raging Fire", "Nou fo", "Benny Chan"),
        ("2020", "Better Days", "Shao nian de ni", "Derek Tsang"),
        ("2019", "Project Gutenberg", "Mou seung", "Felix Chong"),
        ("2018", "Our Time Will Come", "Ming yue ji shi you", "Ann Hui"),
        ("2017", "Trivisa", "Shu da zhao feng", "Frank Hui"),
        ("2014", "The Grandmaster", "Yi dai zong shi", "Wong Kar-wai"),
        ("2013", "Cold War", "Hon zin", "Longman Leung"),
        ("2012", "A Simple Life", "Tou jie", "Ann Hui"),
        ("2011", "Gallants", "Da lui toi", "Derek Kwok"),
        ("2010", "Bodyguards and Assassins", "Shi yue wei cheng", "Teddy Chan"),
        ("2009", "Ip Man", "Yip Man", "Wilson Yip"),
        ("2008", "The Warlords", "Tou ming zhuang", "Peter Chan"),
        ("2007", "After This Our Exile", "Fu zi", "Patrick Tam"),
        ("2006", "Election", "Hak se wui", "Johnnie To"),
        ("2005", "Kung Fu Hustle", "Gong fu", "Stephen Chow"),
        ("2003", "Infernal Affairs", "Mou gaan dou", "Andrew Lau"),
        ("2002", "Shaolin Soccer", "Siu lam juk kau", "Stephen Chow"),
        ("2001", "Crouching Tiger, Hidden Dragon", "Wo hu cang long", "Ang Lee"),
        ("2000", "The Mission", "Cheung fo", "Johnnie To"),
        ("1998", "Made in Hong Kong", "Heung Gong jai jo", "Fruit Chan"),
        ("1997", "Comrades: Almost a Love Story", "Tian mi mi", "Peter Chan"),
        ("1995", "Chungking Express", "Chong qing sen lin", "Wong Kar-wai"),
        ("1991", "Days of Being Wild", "Ah fei zing zyun", "Wong Kar-wai"),
        ("1990", "The Killer", "Dip huet seung hung", "John Woo"),
        ("1989", "Rouge", "Yin ji kau", "Stanley Kwan"),
        ("1987", "A Better Tomorrow", "Ying hung boon sik", "John Woo"),
        ("1986", "Police Story", "Ging chat goo si", "Jackie Chan"),
        ("1983", "Boat People", "Tau ban no hoi", "Ann Hui"),
    ],
    "ariel": [
        ("2024", "Tótem", "", "Lila Avilés"),
        ("2023", "Northern Skies Over Empty Space", "El norte sobre el vacío", "Alejandra Márquez Abella"),
        ("2022", "Prayers for the Stolen", "Noche de fuego", "Tatiana Huezo"),
        ("2021", "I'm No Longer Here", "Ya no estoy aquí", "Fernando Frías de la Parra"),
        ("2019", "Roma", "", "Alfonso Cuarón"),
        ("2018", "I Dream in Another Language", "Sueño en otro idioma", "Ernesto Contreras"),
        ("2016", "600 Miles", "600 Millas", "Gabriel Ripstein"),
        ("2015", "Güeros", "", "Alonso Ruizpalacios"),
        ("2014", "The Golden Dream", "La jaula de oro", "Diego Quemada-Díez"),
        ("2011", "Hell", "El infierno", "Luis Estrada"),
        ("2007", "Pan's Labyrinth", "El laberinto del fauno", "Guillermo del Toro"),
        ("2005", "Duck Season", "Temporada de patos", "Fernando Eimbcke"),
        ("2001", "Amores Perros", "", "Alejandro G. Iñárritu"),
        ("1993", "Cronos", "", "Guillermo del Toro"),
        ("1992", "Like Water for Chocolate", "Como agua para chocolate", "Alfonso Arau"),
        ("1976", "Canoa: A Shameful Memory", "Canoa", "Felipe Cazals"),
        ("1951", "The Forgotten Ones", "Los Olvidados", "Luis Buñuel"),
    ],
    "guldbagge": [
        ("2024", "Paradise Is Burning", "Paradiset brinner", "Mika Gustafson"),
        ("2023", "Triangle of Sadness", "", "Ruben Östlund"),
        ("2022", "Clara Sola", "", "Nathalie Álvarez Mesén"),
        ("2020", "And Then We Danced", "", "Levan Akin"),
        ("2019", "Border", "Gräns", "Ali Abbasi"),
        ("2018", "The Nile Hilton Incident", "", "Tarik Saleh"),
        ("2016", "A Man Called Ove", "En man som heter Ove", "Hannes Holm"),
        ("2015", "Force Majeure", "Turist", "Ruben Östlund"),
        ("2013", "Eat Sleep Die", "Äta sova dö", "Gabriela Pichler"),
        ("2012", "She Monkeys", "Apflickorna", "Lisa Aschan"),
        ("2011", "Beyond", "Svinalängorna", "Pernilla August"),
        ("2009", "Let the Right One In", "Låt den rätte komma in", "Tomas Alfredson"),
        ("2008", "You, the Living", "Du levande", "Roy Andersson"),
        ("2004", "Evil", "Ondskan", "Mikael Håfström"),
        ("2001", "Songs from the Second Floor", "Sånger från andra våningen", "Roy Andersson"),
        ("1999", "Show Me Love", "Fucking Åmål", "Lukas Moodysson"),
        ("1986", "My Life as a Dog", "Mitt liv som hund", "Lasse Hallström"),
        ("1983", "Fanny and Alexander", "Fanny och Alexander", "Ingmar Bergman"),
        ("1973", "Cries and Whispers", "Viskningar och rop", "Ingmar Bergman"),
        ("1967", "Persona", "", "Ingmar Bergman"),
        ("1964", "The Silence", "Tystnaden", "Ingmar Bergman"),
    ],
    "bodil": [
        ("2024", "The Promised Land", "Bastarden", "Nikolaj Arcel"),
        ("2023", "Holy Spider", "", "Ali Abbasi"),
        ("2021", "Another Round", "Druk", "Thomas Vinterberg"),
        ("2020", "Queen of Hearts", "Dronningen", "May el-Toukhy"),
        ("2019", "Holiday", "", "Isabella Eklöf"),
        ("2018", "Winter Brothers", "Vinterbrødre", "Hlynur Pálmason"),
        ("2016", "Land of Mine", "Under sandet", "Martin Zandvliet"),
        ("2015", "Silent Heart", "Stille hjerte", "Bille August"),
        ("2014", "The Hunt", "Jagten", "Thomas Vinterberg"),
        ("2013", "A Hijacking", "Kapringen", "Tobias Lindholm"),
        ("2011", "In a Better World", "Hævnen", "Susanne Bier"),
        ("2010", "Antichrist", "", "Lars von Trier"),
        ("2007", "After the Wedding", "Efter brylluppet", "Susanne Bier"),
        ("2003", "Open Hearts", "Elsker dig for evigt", "Susanne Bier"),
        ("2001", "Italian for Beginners", "Italiensk for begyndere", "Lone Scherfig"),
        ("1999", "The Celebration", "Festen", "Thomas Vinterberg"),
        ("1997", "Breaking the Waves", "", "Lars von Trier"),
        ("1992", "Europa", "", "Lars von Trier"),
        ("1988", "Pelle the Conqueror", "Pelle Erobreren", "Bille August"),
        ("1987", "Babette's Feast", "Babettes gæstebud", "Gabriel Axel"),
        ("1965", "Gertrud", "", "Carl Theodor Dreyer"),
        ("1955", "The Word", "Ordet", "Carl Theodor Dreyer"),
    ],
    "brazilian_cinema": [
        ("2023", "Mars One", "Marte Um", "Gabriel Martins"),
        ("2022", "7 Prisoners", "7 Prisioneiros", "Alexandre Moratto"),
        ("2020", "Bacurau", "", "Kleber Mendonça Filho"),
        ("2018", "Bingo: The King of the Mornings", "Bingo: O Rei das Manhãs", "Daniel Rezende"),
        ("2017", "Aquarius", "", "Kleber Mendonça Filho"),
        ("2016", "The Second Mother", "Que Horas Ela Volta?", "Anna Muylaert"),
        ("2015", "A Wolf at the Door", "O Lobo atrás da Porta", "Fernando Coimbra"),
        ("2012", "The Clown", "O Palhaço", "Selton Mello"),
        ("2011", "Elite Squad: The Enemy Within", "Tropa de Elite 2", "José Padilha"),
        ("2008", "Elite Squad", "Tropa de Elite", "José Padilha"),
        ("2007", "The Year My Parents Went on Vacation", "O Ano em que Meus Pais Saíram de Férias", "Cao Hamburger"),
        ("2006", "Cinema, Aspirins and Vultures", "Cinema, Aspirinas e Urubus", "Marcelo Gomes"),
        ("2004", "Carandiru", "", "Héctor Babenco"),
        ("2003", "City of God", "Cidade de Deus", "Fernando Meirelles"),
        ("1999", "Central Station", "Central do Brasil", "Walter Salles"),
    ],
    "filmfest_munchen": [
        ("2024", "The Seed of the Sacred Fig", "Danaye anjir-e ma'abed", "Mohammad Rasoulof"),
        ("2024", "The Zone of Interest", "", "Jonathan Glazer"),
        ("2023", "Anatomy of a Fall", "Anatomie d'une chute", "Justine Triet"),
        ("2023", "About Dry Grasses", "Kuru Otlar Üstüne", "Nuri Bilge Ceylan"),
        ("2022", "Decision to Leave", "Heojil gyeolsim", "Park Chan-wook"),
        ("2022", "Broker", "", "Hirokazu Kore-eda"),
        ("2021", "Drive My Car", "", "Ryusuke Hamaguchi"),
        ("2021", "Memoria", "", "Apichatpong Weerasethakul"),
        ("2019", "Parasite", "Gisaengchung", "Bong Joon-ho"),
        ("2018", "Capernaum", "Capharnaüm", "Nadine Labaki"),
        ("2018", "Border", "Gräns", "Ali Abbasi"),
        ("2016", "Toni Erdmann", "", "Maren Ade"),
        ("2014", "Leviathan", "Leviafan", "Andrey Zvyagintsev"),
        ("2013", "The Past", "Le Passé", "Asghar Farhadi"),
        ("2012", "Holy Motors", "", "Leos Carax"),
    ],
    "london_film_fest": [
        ("2024", "On Becoming a Guinea Fowl", "", "Rungano Nyoni"),
        ("2023", "Evil Does Not Exist", "Aku wa Sonzai Shinai", "Ryusuke Hamaguchi"),
        ("2022", "Corsage", "", "Marie Kreutzer"),
        ("2021", "Hit the Road", "Jaddeh Khaki", "Panah Panahi"),
        ("2020", "Another Round", "Druk", "Thomas Vinterberg"),
        ("2019", "Monos", "", "Alejandro Landes"),
        ("2018", "Joy", "", "Sudabeh Mortezai"),
        ("2017", "Loveless", "Nelyubov", "Andrey Zvyagintsev"),
        ("2016", "Certain Women", "", "Kelly Reichardt"),
        ("2015", "Chevalier", "", "Athina Rachel Tsangari"),
        ("2014", "Leviathan", "Leviafan", "Andrey Zvyagintsev"),
        ("2013", "Ida", "", "Paweł Pawlikowski"),
        ("2012", "Rust and Bone", "De rouille et d'os", "Jacques Audiard"),
        ("2011", "We Need to Talk About Kevin", "", "Lynne Ramsay"),
        ("2010", "How I Ended This Summer", "Kak ya provyol etim letom", "Alexei Popogrebsky"),
        ("2009", "A Prophet", "Un Prophète", "Jacques Audiard"),
    ],
    "busan_new_currents": [
        ("2023", "Solid by the Seashore", "", "Patiparn Boontarig"),
        ("2022", "Shivamma", "", "Jaishankar Aryar"),
        ("2022", "A Wild Roomer", "Gwae-in", "Lee Jeong-hong"),
        ("2021", "The Apartment with Two Women", "Gateun sogsot", "Kim Se-in"),
        ("2019", "Moving On", "Nam-mae-wui Yeo-reum-bam", "Yoon Dan-bi"),
        ("2018", "Clean Up", "", "Kwon Man-ki"),
        ("2018", "House of Hummingbird", "Beol-sae", "Kim Bora"),
        ("2017", "Last Child", "Sal-a-nam-eun a-i", "Shin Dong-seok"),
        ("2017", "Blockage", "Sad-e Ma'bar", "Mohsen Gharaei"),
        ("2015", "The Boys Who Cried Wolf", "Yang-chi-deul", "Kim Jin-hwang"),
        ("2012", "36", "", "Nawapol Thamrongrattanarit"),
        ("2010", "Bleak Night", "Pa-soo-kkun", "Yoon Sung-hyun"),
    ],
    "sydney_film_fest": [
        ("2024", "There's Still Tomorrow", "C'è ancora domani", "Paola Cortellesi"),
        ("2023", "The Mother of All Lies", "Kadib Abyad", "Asmae El Moudir"),
        ("2022", "Close", "", "Lukas Dhont"),
        ("2021", "There Is No Evil", "Sheytan vojud nadarad", "Mohammad Rasoulof"),
        ("2019", "Parasite", "Gisaengchung", "Bong Joon-ho"),
        ("2018", "The Heiresses", "Las herederas", "Marcelo Martinessi"),
        ("2017", "On Body and Soul", "Testről és lélekről", "Ildikó Enyedi"),
        ("2016", "Aquarius", "", "Kleber Mendonça Filho"),
        ("2015", "Arabian Nights", "As Mil e Uma Noites", "Miguel Gomes"),
        ("2014", "Two Days, One Night", "Deux jours, une nuit", "Jean-Pierre Dardenne"),
        ("2013", "Only God Forgives", "", "Nicolas Winding Refn"),
        ("2012", "Alps", "Alpeis", "Yorgos Lanthimos"),
        ("2011", "A Separation", "Jodaeiye Nader az Simin", "Asghar Farhadi"),
        ("2010", "Heartbeats", "Les amours imaginaires", "Xavier Dolan"),
        ("2009", "Bronson", "", "Nicolas Winding Refn"),
        ("2008", "Hunger", "", "Steve McQueen"),
    ],
    "goteborg": [
        ("2024", "Mother, Couch!", "", "Niclas Larsson"),
        ("2023", "Unruly", "Ustyrlig", "Malou Reymann"),
        ("2022", "Godland", "Vanskabte Land", "Hlynur Pálmason"),
        ("2021", "Pleasure", "", "Ninja Thyberg"),
        ("2020", "Another Round", "Druk", "Thomas Vinterberg"),
        ("2019", "Queen of Hearts", "Dronningen", "May el-Toukhy"),
        ("2018", "Amateur", "Amatörer", "Gabriela Pichler"),
        ("2017", "Heartstone", "Hjartasteinn", "Guðmundur Arnar Guðmundsson"),
        ("2011", "She Monkeys", "Apflickorna", "Lisa Aschan"),
        ("2010", "Submarino", "", "Thomas Vinterberg"),
        ("2008", "Let the Right One In", "Låt den rätte komma in", "Tomas Alfredson"),
        ("2006", "The Bothersome Man", "Den brysomme mannen", "Jens Lien"),
    ],
    "sitges": [
        ("2024", "The Substance", "", "Coralie Fargeat"),
        ("2023", "When Evil Lurks", "Cuando acecha la maldad", "Demián Rugna"),
        ("2022", "Sisu", "", "Jalmari Helander"),
        ("2021", "Lamb", "Dýrið", "Valdimar Jóhannsson"),
        ("2020", "Possessor", "", "Brandon Cronenberg"),
        ("2019", "The Platform", "El hoyo", "Galder Gaztelu-Urrutia"),
        ("2018", "Climax", "", "Gaspar Noé"),
        ("2017", "Jupiter's Moon", "Jupiter holdja", "Kornél Mundruczó"),
        ("2016", "Swiss Army Man", "", "Daniel Kwan"),
        ("2015", "The Invitation", "", "Karyn Kusama"),
        ("2014", "I Origins", "", "Mike Cahill"),
        ("2013", "Borgman", "", "Alex van Warmerdam"),
        ("2012", "Holy Motors", "", "Leos Carax"),
        ("2011", "Red State", "", "Kevin Smith"),
        ("2010", "Rare Exports: A Christmas Tale", "Rare Exports", "Jalmari Helander"),
        ("2009", "Moon", "", "Duncan Jones"),
        ("2008", "Surveillance", "", "Jennifer Lynch"),
        ("2006", "The Host", "Gwoemul", "Bong Joon-ho"),
        ("2005", "Hard Candy", "", "David Slade"),
        ("2003", "Oldboy", "Oldeuboi", "Park Chan-wook"),
        ("2001", "Donnie Darko", "", "Richard Kelly"),
        ("1999", "Ring", "Ringu", "Hideo Nakata"),
        ("1998", "Cube", "", "Vincenzo Natali"),
        ("1997", "Gattaca", "", "Andrew Niccol"),
        ("1993", "Reservoir Dogs", "", "Quentin Tarantino"),
        ("1986", "Blue Velvet", "", "David Lynch"),
    ],
    "annecy_animation": [
        ("2024", "Flow", "Straume", "Gints Zilbalodis"),
        ("2024", "Memoir of a Snail", "", "Adam Elliot"),
        ("2023", "Chicken for Linda!", "Linda veut du poulet!", "Chiara Malta"),
        ("2022", "Little Nicholas: Happy as Can Be", "Le Petit Nicolas", "Amandine Fredon"),
        ("2021", "Flee", "Flugt", "Jonas Poher Rasmussen"),
        ("2020", "Calamity, a Childhood of Martha Jane Cannary", "Calamity", "Rémi Chayé"),
        ("2019", "I Lost My Body", "J'ai perdu mon corps", "Jérémy Clapin"),
        ("2018", "Funan", "", "Denis Do"),
        ("2017", "Lu Over the Wall", "Yoake Tsugeru Rū no Uta", "Masaaki Yuasa"),
        ("2016", "My Life as a Zucchini", "Ma vie de Courgette", "Claude Barras"),
        ("2015", "April and the Extraordinary World", "Avril et le Monde truqué", "Christian Desmares"),
        ("2014", "Boy and the World", "O Menino e o Mundo", "Alê Abreu"),
        ("2011", "The Rabbi's Cat", "Le Chat du rabbin", "Joann Sfar"),
        ("2010", "The Illusionist", "L'Illusionniste", "Sylvain Chomet"),
        ("2009", "Coraline", "", "Henry Selick"),
        ("2008", "Sita Sings the Blues", "", "Nina Paley"),
        ("2007", "Persepolis", "", "Marjane Satrapi"),
        ("1999", "Kirikou and the Sorceress", "Kirikou et la Sorcière", "Michel Ocelot"),
        ("1993", "Porco Rosso", "Kurenai no Buta", "Hayao Miyazaki"),
    ],
    "lafca": [
        ("2024", "Anora", "", "Sean Baker"),
        ("2023", "The Zone of Interest", "", "Jonathan Glazer"),
        ("2022", "TAR", "", "Todd Field"),
        ("2022", "Everything Everywhere All at Once", "", "Daniel Kwan"),
        ("2021", "Drive My Car", "", "Ryusuke Hamaguchi"),
        ("2020", "Small Axe", "", "Steve McQueen"),
        ("2019", "Parasite", "", "Bong Joon-ho"),
        ("2018", "Roma", "", "Alfonso Cuarón"),
        ("2017", "Call Me by Your Name", "", "Luca Guadagnino"),
        ("2016", "Moonlight", "", "Barry Jenkins"),
        ("2015", "Spotlight", "", "Tom McCarthy"),
        ("2014", "Boyhood", "", "Richard Linklater"),
        ("2013", "Her", "", "Spike Jonze"),
        ("2013", "Gravity", "", "Alfonso Cuarón"),
        ("2012", "Amour", "", "Michael Haneke"),
        ("2011", "The Descendants", "", "Alexander Payne"),
        ("2010", "The Social Network", "", "David Fincher"),
        ("2009", "The Hurt Locker", "", "Kathryn Bigelow"),
        ("2008", "WALL-E", "", "Andrew Stanton"),
        ("2007", "There Will Be Blood", "", "Paul Thomas Anderson"),
        ("2006", "Letters from Iwo Jima", "", "Clint Eastwood"),
        ("2005", "Brokeback Mountain", "", "Ang Lee"),
        ("2004", "Sideways", "", "Alexander Payne"),
        ("2003", "American Splendor", "", "Shari Springer Berman"),
        ("2002", "About Schmidt", "", "Alexander Payne"),
        ("2001", "In the Bedroom", "", "Todd Field"),
        ("2000", "Crouching Tiger, Hidden Dragon", "", "Ang Lee"),
        ("1999", "The Insider", "", "Michael Mann"),
        ("1998", "Saving Private Ryan", "", "Steven Spielberg"),
        ("1997", "L.A. Confidential", "", "Curtis Hanson"),
        ("1996", "Secrets & Lies", "", "Mike Leigh"),
        ("1995", "Leaving Las Vegas", "", "Mike Figgis"),
        ("1994", "Pulp Fiction", "", "Quentin Tarantino"),
        ("1993", "Schindler's List", "", "Steven Spielberg"),
        ("1992", "Unforgiven", "", "Clint Eastwood"),
        ("1991", "Bugsy", "", "Barry Levinson"),
        ("1990", "Goodfellas", "", "Martin Scorsese"),
        ("1989", "Do the Right Thing", "", "Spike Lee"),
        ("1986", "Blue Velvet", "", "David Lynch"),
        ("1985", "Brazil", "", "Terry Gilliam"),
        ("1984", "Amadeus", "", "Miloš Forman"),
        ("1982", "E.T. the Extra-Terrestrial", "", "Steven Spielberg"),
        ("1980", "Raging Bull", "", "Martin Scorsese"),
        ("1979", "Apocalypse Now", "", "Francis Ford Coppola"),
        ("1977", "Star Wars", "", "George Lucas"),
        ("1976", "Network", "", "Sidney Lumet"),
        ("1975", "One Flew Over the Cuckoo's Nest", "", "Miloš Forman"),
    ],
    "nsfc": [
        ("2024", "Past Lives", "", "Celine Song"),
        ("2023", "TAR", "", "Todd Field"),
        ("2022", "Drive My Car", "", "Ryusuke Hamaguchi"),
        ("2021", "Nomadland", "", "Chloé Zhao"),
        ("2020", "Parasite", "", "Bong Joon-ho"),
        ("2019", "The Rider", "", "Chloé Zhao"),
        ("2018", "Lady Bird", "", "Greta Gerwig"),
        ("2017", "Moonlight", "", "Barry Jenkins"),
        ("2016", "Spotlight", "", "Tom McCarthy"),
        ("2015", "Goodbye to Language", "Adieu au langage", "Jean-Luc Godard"),
        ("2014", "Inside Llewyn Davis", "", "Joel Coen"),
        ("2013", "Amour", "", "Michael Haneke"),
        ("2012", "Melancholia", "", "Lars von Trier"),
        ("2011", "The Social Network", "", "David Fincher"),
        ("2010", "The Hurt Locker", "", "Kathryn Bigelow"),
        ("2009", "Waltz with Bashir", "Vals Im Bashir", "Ari Folman"),
        ("2008", "There Will Be Blood", "", "Paul Thomas Anderson"),
        ("2007", "Pan's Labyrinth", "El laberinto del fauno", "Guillermo del Toro"),
        ("2006", "Capote", "", "Bennett Miller"),
        ("2005", "Million Dollar Baby", "", "Clint Eastwood"),
        ("2004", "American Splendor", "", "Shari Springer Berman"),
        ("2003", "The Pianist", "", "Roman Polanski"),
        ("2002", "Mulholland Drive", "", "David Lynch"),
        ("2001", "Yi Yi", "", "Edward Yang"),
        ("2000", "Being John Malkovich", "", "Spike Jonze"),
        ("1999", "Out of Sight", "", "Steven Soderbergh"),
        ("1998", "L.A. Confidential", "", "Curtis Hanson"),
        ("1997", "Breaking the Waves", "", "Lars von Trier"),
        ("1996", "Babe", "", "Chris Noonan"),
        ("1995", "Pulp Fiction", "", "Quentin Tarantino"),
        ("1994", "Schindler's List", "", "Steven Spielberg"),
        ("1993", "Unforgiven", "", "Clint Eastwood"),
        ("1992", "Life Is Sweet", "", "Mike Leigh"),
        ("1991", "Goodfellas", "", "Martin Scorsese"),
        ("1990", "Drugstore Cowboy", "", "Gus Van Sant"),
        ("1989", "The Unbearable Lightness of Being", "", "Philip Kaufman"),
        ("1987", "Blue Velvet", "", "David Lynch"),
        ("1986", "Ran", "", "Akira Kurosawa"),
        ("1985", "Stranger Than Paradise", "", "Jim Jarmusch"),
        ("1981", "Raging Bull", "", "Martin Scorsese"),
        ("1978", "Annie Hall", "", "Woody Allen"),
        ("1977", "All the President's Men", "", "Alan J. Pakula"),
        ("1976", "Nashville", "", "Robert Altman"),
        ("1975", "Scenes from a Marriage", "Scener ur ett äktenskap", "Ingmar Bergman"),
        ("1974", "Day for Night", "La Nuit américaine", "François Truffaut"),
        ("1973", "The Discreet Charm of the Bourgeoisie", "Le Charme discret de la bourgeoisie", "Luis Buñuel"),
        ("1967", "Blow-Up", "", "Michelangelo Antonioni"),
        ("1966", "Persona", "", "Ingmar Bergman"),
    ],
    "spirit_awards": [
        ("2024", "Anora", "", "Sean Baker"),
        ("2023", "Past Lives", "", "Celine Song"),
        ("2022", "Everything Everywhere All at Once", "", "Daniel Kwan"),
        ("2021", "The Lost Daughter", "", "Maggie Gyllenhaal"),
        ("2020", "Nomadland", "", "Chloé Zhao"),
        ("2019", "The Farewell", "", "Lulu Wang"),
        ("2018", "If Beale Street Could Talk", "", "Barry Jenkins"),
        ("2017", "Get Out", "", "Jordan Peele"),
        ("2016", "Moonlight", "", "Barry Jenkins"),
        ("2015", "Spotlight", "", "Tom McCarthy"),
        ("2014", "Birdman", "", "Alejandro G. Iñárritu"),
        ("2013", "12 Years a Slave", "", "Steve McQueen"),
        ("2012", "Silver Linings Playbook", "", "David O. Russell"),
        ("2011", "The Artist", "", "Michel Hazanavicius"),
        ("2010", "Black Swan", "", "Darren Aronofsky"),
        ("2009", "Precious", "", "Lee Daniels"),
        ("2008", "The Wrestler", "", "Darren Aronofsky"),
        ("2007", "Juno", "", "Jason Reitman"),
        ("2006", "Little Miss Sunshine", "", "Jonathan Dayton"),
        ("2005", "Brokeback Mountain", "", "Ang Lee"),
        ("2004", "Sideways", "", "Alexander Payne"),
        ("2003", "Lost in Translation", "", "Sofia Coppola"),
        ("2002", "Far from Heaven", "", "Todd Haynes"),
        ("2001", "Memento", "", "Christopher Nolan"),
        ("2000", "Crouching Tiger, Hidden Dragon", "", "Ang Lee"),
        ("1999", "Election", "", "Alexander Payne"),
        ("1998", "Gods and Monsters", "", "Bill Condon"),
        ("1997", "The Apostle", "", "Robert Duvall"),
        ("1996", "Fargo", "", "Joel Coen"),
        ("1995", "Leaving Las Vegas", "", "Mike Figgis"),
        ("1994", "Pulp Fiction", "", "Quentin Tarantino"),
        ("1993", "Short Cuts", "", "Robert Altman"),
        ("1992", "The Player", "", "Robert Altman"),
        ("1991", "Rambling Rose", "", "Martha Coolidge"),
        ("1990", "The Grifters", "", "Stephen Frears"),
        ("1989", "Sex, Lies, and Videotape", "", "Steven Soderbergh"),
        ("1988", "Stand and Deliver", "", "Ramón Menéndez"),
        ("1987", "River's Edge", "", "Tim Hunter"),
        ("1986", "Platoon", "", "Oliver Stone"),
        ("1985", "After Hours", "", "Martin Scorsese"),
    ],
    "gotham_awards": [
        ("2024", "A Different Man", "", "Aaron Schimberg"),
        ("2023", "Past Lives", "", "Celine Song"),
        ("2022", "Everything Everywhere All at Once", "", "Daniel Kwan"),
        ("2021", "The Lost Daughter", "", "Maggie Gyllenhaal"),
        ("2020", "Nomadland", "", "Chloé Zhao"),
        ("2019", "Marriage Story", "", "Noah Baumbach"),
        ("2018", "The Rider", "", "Chloé Zhao"),
        ("2017", "Call Me by Your Name", "", "Luca Guadagnino"),
        ("2016", "Moonlight", "", "Barry Jenkins"),
        ("2015", "Spotlight", "", "Tom McCarthy"),
        ("2014", "Birdman", "", "Alejandro G. Iñárritu"),
        ("2013", "Inside Llewyn Davis", "", "Joel Coen"),
        ("2012", "Moonrise Kingdom", "", "Wes Anderson"),
        ("2011", "The Tree of Life", "", "Terrence Malick"),
        ("2011", "Beginners", "", "Mike Mills"),
        ("2010", "Winter's Bone", "", "Debra Granik"),
        ("2009", "The Hurt Locker", "", "Kathryn Bigelow"),
        ("2008", "Frozen River", "", "Courtney Hunt"),
        ("2007", "Into the Wild", "", "Sean Penn"),
        ("2006", "Half Nelson", "", "Ryan Fleck"),
        ("2005", "Capote", "", "Bennett Miller"),
        ("2004", "Sideways", "", "Alexander Payne"),
    ],
    "national_film_awards_india": [
        ("2024", "Aattam", "", "Anand Ekarshi"),
        ("2023", "Rocketry: The Nambi Effect", "", "R. Madhavan"),
        ("2022", "Soorarai Pottru", "", "Sudha Kongara"),
        ("2021", "Marakkar: Lion of the Arabian Sea", "Marakkar: Arabikadalinte Simham", "Priyadarshan"),
        ("2019", "Hellaro", "", "Abhishek Shah"),
        ("2018", "Village Rockstars", "", "Rima Das"),
        ("2017", "Kaasav", "", "Sumitra Bhave"),
        ("2016", "Baahubali: The Beginning", "", "S.S. Rajamouli"),
        ("2015", "Court", "", "Chaitanya Tamhane"),
        ("2014", "Ship of Theseus", "", "Anand Gandhi"),
        ("2012", "Deool", "", "Umesh Vinayak Kulkarni"),
        ("2011", "Adaminte Makan Abu", "", "Salim Ahamed"),
        ("2010", "Kutty Srank", "", "Shaji N. Karun"),
        ("2008", "Kanchivaram", "", "Priyadarshan"),
        ("2005", "Page 3", "", "Madhur Bhandarkar"),
        ("2004", "Shwaas", "", "Sandeep Sawant"),
        ("2000", "Vanaprastham", "", "Shaji N. Karun"),
        ("1993", "Thevar Magan", "", "Bharathan"),
        ("1991", "Agantuk", "", "Satyajit Ray"),
        ("1989", "Piravi", "", "Shaji N. Karun"),
        ("1984", "Adi Shankaracharya", "", "G.V. Iyer"),
        ("1982", "Elippathayam", "", "Adoor Gopalakrishnan"),
        ("1978", "Ghatashraddha", "", "Girish Kasaravalli"),
        ("1970", "Samskara", "", "Pattabhirama Reddy"),
        ("1969", "Bhuvan Shome", "", "Mrinal Sen"),
        ("1964", "Charulata", "", "Satyajit Ray"),
        ("1959", "Apur Sansar", "", "Satyajit Ray"),
        ("1955", "Pather Panchali", "", "Satyajit Ray"),
    ],
}

def main():
    if not os.path.exists(OUTPUT_JSON):
        print(f"Base awards catalog not found at {OUTPUT_JSON}")
        sys.exit(1)

    with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    cache = load_cache()
    print(f"Loaded {len(cache)} cached TMDb items.")

    existing_ceremonies = catalog.get("ceremonies", [])
    existing_all_winners = catalog.get("allWinners", [])
    all_winners_map = {w["id"]: w for w in existing_all_winners}

    total_new_films_resolved = 0
    new_ceremonies_output = []

    # Process all 24 new ceremonies
    for c_key, meta in EXTENDED_CEREMONY_META.items():
        print(f"Resolving {meta['name']}...")
        winners_raw = NEW_CEREMONY_WINNERS.get(c_key, [])
        winners_list = []
        seen_films_for_ceremony = set()

        for yr, title, orig, director in winners_raw:
            tmdb_item = resolve_tmdb_item(title, orig, yr, director, cache)
            if not tmdb_item:
                print(f"  [MISS] Could not resolve: {title} ({yr})")
                continue

            movie_id = tmdb_item["id"]
            ceremony_film_key = f"{movie_id}:{yr}"
            if ceremony_film_key in seen_films_for_ceremony:
                continue
            seen_films_for_ceremony.add(ceremony_film_key)

            winner_record = {
                **tmdb_item,
                "awardYear": yr,
                "award": meta["awardName"],
                "position": 1,
                "ceremonyId": c_key,
                "ceremonyName": meta["name"],
                "director": director or tmdb_item.get("director", ""),
            }
            winners_list.append(winner_record)

            # Update or insert into global all_winners_map
            if movie_id not in all_winners_map:
                all_winners_map[movie_id] = {
                    **tmdb_item,
                    "awards": [],
                }
                total_new_films_resolved += 1

            # Check if this ceremony win is already listed
            has_ceremony_award = any(
                a.get("ceremonyId") == c_key and a.get("year") == yr
                for a in all_winners_map[movie_id]["awards"]
            )
            if not has_ceremony_award:
                all_winners_map[movie_id]["awards"].append({
                    "ceremonyId": c_key,
                    "ceremonyName": meta["name"],
                    "award": meta["awardName"],
                    "year": yr,
                    "position": 1,
                })

        winners_list.sort(key=lambda x: str(x.get("awardYear", "")), reverse=True)
        new_ceremonies_output.append({
            **meta,
            "winnersCount": len(winners_list),
            "winners": winners_list,
        })
        print(f"  -> {meta['shortName']}: {len(winners_list)} films resolved.")

    save_cache(cache)

    # Combine existing and new ceremonies
    combined_ceremonies = existing_ceremonies + new_ceremonies_output
    combined_all_winners = list(all_winners_map.values())
    combined_all_winners.sort(key=lambda x: (len(x.get("awards", [])), x.get("ratingValue", 0)), reverse=True)

    updated_catalog = {
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "totalCeremonies": len(combined_ceremonies),
        "totalUniqueWinners": len(combined_all_winners),
        "ceremonies": combined_ceremonies,
        "allWinners": combined_all_winners,
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(updated_catalog, f, indent=2, ensure_ascii=False)

    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write("export const awardsData = " + json.dumps(updated_catalog, indent=2, ensure_ascii=False) + ";\nexport default awardsData;\n")

    print("\n==========================================")
    print(f"Successfully generated updated catalog!")
    print(f"Total ceremonies: {len(combined_ceremonies)} (22 original + 24 new)")
    print(f"Total unique winning films: {len(combined_all_winners)}")
    print(f"New unique films added: {total_new_films_resolved}")
    print("==========================================")

if __name__ == "__main__":
    main()
