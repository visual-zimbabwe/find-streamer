#!/usr/bin/env python3
"""
Trova Prestigious Global Television Honors Catalog Builder
Builds src/data/tv_awards_catalog.json and src/data/tv_awards_catalog.js
across the Top 40 Global TV Show Awards, combining:
1. Comprehensive historical winner archives across all 40 ceremonies
2. Live Wikidata SPARQL enrichment (supporting P166 on series, P179 season->series rollup,
   P1346 winner statements, P4983 TMDb TV IDs, and P345 IMDb ID -> TMDb /find resolution)
3. Full TMDb TV Series metadata resolution (poster, backdrop, rating, originalLanguageCode).
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
CACHE_FILE = os.path.join(BASE_DIR, "scripts", ".tmdb_tv_awards_cache.json")
OUTPUT_JSON = os.path.join(BASE_DIR, "src", "data", "tv_awards_catalog.json")
OUTPUT_JS = os.path.join(BASE_DIR, "src", "data", "tv_awards_catalog.js")

TMDB_API_KEY = "d90e408fc05fa0c35ebbbc220515d376"
WIKIDATA_USER_AGENT = "Trova/1.0 (juwimana.database@gmail.com)"

TV_CEREMONY_METADATA = {
    # I. Flagship US Academies & Major Honors (1–10)
    "emmy_drama": {
        "id": "emmy_drama",
        "name": "Primetime Emmy Awards – Best Drama Series",
        "shortName": "Emmy Drama",
        "awardName": "Outstanding Drama Series",
        "wikidataId": "Q989438",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 1951,
        "icon": "trophy-outline",
        "badgeColor": "#D4AF37",
        "mediaType": "tv",
        "description": "Television's highest dramatic accolade, presented annually by the Academy of Television Arts & Sciences.",
    },
    "emmy_comedy": {
        "id": "emmy_comedy",
        "name": "Primetime Emmy Awards – Best Comedy Series",
        "shortName": "Emmy Comedy",
        "awardName": "Outstanding Comedy Series",
        "wikidataId": "Q2110156",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 1952,
        "icon": "happy-outline",
        "badgeColor": "#F59E0B",
        "mediaType": "tv",
        "description": "Honoring the most brilliant, culturally defining comedic television series in American broadcasting and streaming.",
    },
    "emmy_limited": {
        "id": "emmy_limited",
        "name": "Primetime Emmy Awards – Limited & Anthology Series",
        "shortName": "Emmy Limited",
        "awardName": "Outstanding Limited or Anthology Series",
        "wikidataId": "Q20714679",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 1973,
        "icon": "sparkles-outline",
        "badgeColor": "#C5A059",
        "mediaType": "tv",
        "description": "Celebrating landmark miniseries and anthology masterworks of prestige television.",
    },
    "emmy_animation": {
        "id": "emmy_animation",
        "name": "Primetime Emmy Awards – Animated Program",
        "shortName": "Emmy Animation",
        "awardName": "Outstanding Animated Program",
        "wikidataId": "Q337926",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 1979,
        "icon": "color-palette-outline",
        "badgeColor": "#F97316",
        "mediaType": "tv",
        "description": "Recognizing the pinnacle of animated storytelling and visual artistry on television.",
    },
    "gg_tv_drama": {
        "id": "gg_tv_drama",
        "name": "Golden Globe Awards – Best Drama Series",
        "shortName": "Golden Globes Drama",
        "awardName": "Best Television Series – Drama",
        "wikidataId": "Q1255198",
        "country": "United States",
        "city": "Beverly Hills",
        "founded": 1962,
        "icon": "globe-outline",
        "badgeColor": "#E5A93C",
        "mediaType": "tv",
        "description": "Awarded annually for the finest dramatic television achievement of the year.",
    },
    "gg_tv_comedy": {
        "id": "gg_tv_comedy",
        "name": "Golden Globe Awards – Best Musical or Comedy Series",
        "shortName": "Golden Globes Comedy",
        "awardName": "Best Television Series – Musical or Comedy",
        "wikidataId": "Q596294",
        "country": "United States",
        "city": "Beverly Hills",
        "founded": 1962,
        "icon": "musical-notes-outline",
        "badgeColor": "#FBBF24",
        "mediaType": "tv",
        "description": "Honoring excellence in comedic and musical episodic television storytelling.",
    },
    "gg_tv_limited": {
        "id": "gg_tv_limited",
        "name": "Golden Globe Awards – Best Limited & Anthology Series",
        "shortName": "Golden Globes Limited",
        "awardName": "Best Limited or Anthology Series",
        "wikidataId": "Q265435",
        "country": "United States",
        "city": "Beverly Hills",
        "founded": 1971,
        "icon": "star-outline",
        "badgeColor": "#E0A96D",
        "mediaType": "tv",
        "description": "Spotlighting acclaimed miniseries and anthology television events.",
    },
    "peabody_tv": {
        "id": "peabody_tv",
        "name": "Peabody Awards – Distinguished Television",
        "shortName": "Peabody",
        "awardName": "George Foster Peabody Award",
        "wikidataId": "Q838121",
        "country": "United States",
        "city": "Athens / Los Angeles",
        "founded": 1941,
        "icon": "medal-outline",
        "badgeColor": "#10B981",
        "mediaType": "tv",
        "description": "The oldest and most prestigious honor in electronic media, awarded by unanimous vote for stories that matter.",
    },
    "afi_tv": {
        "id": "afi_tv",
        "name": "American Film Institute (AFI) – TV Programs of the Year",
        "shortName": "AFI Honors",
        "awardName": "AFI Television Program of the Year",
        "wikidataId": "Q2842921",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 2000,
        "icon": "ribbon-outline",
        "badgeColor": "#3B82F6",
        "mediaType": "tv",
        "description": "Selected by AFI's jury of scholars, artists, and critics to canonize the most culturally significant television of each year.",
    },
    "intl_emmy_drama": {
        "id": "intl_emmy_drama",
        "name": "International Emmy Awards – Best Drama Series",
        "shortName": "Int'l Emmy Drama",
        "awardName": "International Emmy for Best Drama Series",
        "wikidataId": "Q16146879",
        "country": "International",
        "city": "New York",
        "founded": 2002,
        "icon": "earth-outline",
        "badgeColor": "#6366F1",
        "mediaType": "tv",
        "description": "Presented by the International Academy of Television Arts & Sciences to the finest drama series produced outside the US.",
    },

    # II. International & British Television Academies (11–20)
    "intl_emmy_comedy": {
        "id": "intl_emmy_comedy",
        "name": "International Emmy Awards – Best Comedy Series",
        "shortName": "Int'l Emmy Comedy",
        "awardName": "International Emmy for Best Comedy Series",
        "wikidataId": "Q17060082",
        "country": "International",
        "city": "New York",
        "founded": 2003,
        "icon": "planet-outline",
        "badgeColor": "#8B5CF6",
        "mediaType": "tv",
        "description": "Celebrating the world's most inventive and acclaimed international television comedies.",
    },
    "bafta_tv_drama": {
        "id": "bafta_tv_drama",
        "name": "BAFTA Television Awards – Best Drama Series",
        "shortName": "BAFTA TV Drama",
        "awardName": "BAFTA TV Award for Best Drama Series",
        "wikidataId": "Q2925698",
        "country": "United Kingdom",
        "city": "London",
        "founded": 1958,
        "icon": "shield-outline",
        "badgeColor": "#F59E0B",
        "mediaType": "tv",
        "description": "Britain's supreme television accolade, honoring landmark dramatic series from the British Academy.",
    },
    "bafta_tv_comedy": {
        "id": "bafta_tv_comedy",
        "name": "BAFTA Television Awards – Best Scripted Comedy",
        "shortName": "BAFTA TV Comedy",
        "awardName": "BAFTA TV Award for Best Scripted Comedy",
        "wikidataId": "Q4834517",
        "country": "United Kingdom",
        "city": "London",
        "founded": 1973,
        "icon": "sparkles-outline",
        "badgeColor": "#EC4899",
        "mediaType": "tv",
        "description": "Recognizing the sharpest, most iconic British situation comedies and comedic series.",
    },
    "bafta_tv_miniseries": {
        "id": "bafta_tv_miniseries",
        "name": "BAFTA Television Awards – Best Mini-Series",
        "shortName": "BAFTA Mini-Series",
        "awardName": "BAFTA TV Award for Best Mini-Series",
        "wikidataId": "Q65089241",
        "country": "United Kingdom",
        "city": "London",
        "founded": 2000,
        "icon": "layers-outline",
        "badgeColor": "#14B8A6",
        "mediaType": "tv",
        "description": "Honoring extraordinary British limited series and multi-part television dramas.",
    },
    "bafta_tv_international": {
        "id": "bafta_tv_international",
        "name": "BAFTA Television Awards – Best International Programme",
        "shortName": "BAFTA International",
        "awardName": "BAFTA TV Award for Best International Programme",
        "wikidataId": "Q16985329",
        "country": "United Kingdom",
        "city": "London",
        "founded": 1998,
        "icon": "globe-outline",
        "badgeColor": "#06B6D4",
        "mediaType": "tv",
        "description": "The British Academy's tribute to the finest international television series broadcast in the UK.",
    },
    "rts_drama": {
        "id": "rts_drama",
        "name": "Royal Television Society (RTS) Programme Awards",
        "shortName": "RTS Awards",
        "awardName": "RTS Award for Best Drama Series",
        "wikidataId": "Q7374919",
        "country": "United Kingdom",
        "city": "London",
        "founded": 1976,
        "icon": "diamond-outline",
        "badgeColor": "#2563EB",
        "mediaType": "tv",
        "description": "Presented by the world's oldest television society to champion British dramatic excellence.",
    },
    "canadian_screen_tv": {
        "id": "canadian_screen_tv",
        "name": "Canadian Screen Awards – Best Dramatic Series",
        "shortName": "Canadian Screen TV",
        "awardName": "Best Dramatic Series (formerly Gemini Award)",
        "wikidataId": "Q5030549",
        "country": "Canada",
        "city": "Toronto",
        "founded": 1986,
        "icon": "flame-outline",
        "badgeColor": "#DC2626",
        "mediaType": "tv",
        "description": "Canada's premier national television honor presented by the Academy of Canadian Cinema & Television.",
    },
    "aacta_tv_drama": {
        "id": "aacta_tv_drama",
        "name": "AACTA Awards – Best Television Drama Series",
        "shortName": "AACTA TV Drama",
        "awardName": "AACTA Award for Best Television Drama Series",
        "wikidataId": "Q4649844",
        "country": "Australia",
        "city": "Sydney",
        "founded": 1986,
        "icon": "sunny-outline",
        "badgeColor": "#D97706",
        "mediaType": "tv",
        "description": "The Australian Academy's highest accolade for domestic dramatic television storytelling.",
    },
    "grimme_preis": {
        "id": "grimme_preis",
        "name": "Grimme-Preis – Wettbewerb Fiktion",
        "shortName": "Grimme-Preis",
        "awardName": "Grimme-Preis for Best Fiction",
        "wikidataId": "Q459640",
        "country": "Germany",
        "city": "Marl",
        "founded": 1964,
        "icon": "bookmark-outline",
        "badgeColor": "#059669",
        "mediaType": "tv",
        "description": "Germany's most prestigious critics' and cultural television prize for groundbreaking serialized fiction.",
    },
    "deutscher_fernsehpreis": {
        "id": "deutscher_fernsehpreis",
        "name": "Deutscher Fernsehpreis (German Television Awards)",
        "shortName": "Deutscher Fernsehpreis",
        "awardName": "Beste Drama-Serie (Best Drama Series)",
        "wikidataId": "Q316760",
        "country": "Germany",
        "city": "Cologne",
        "founded": 1999,
        "icon": "trophy-outline",
        "badgeColor": "#E11D48",
        "mediaType": "tv",
        "description": "Germany's premier annual television academy awards celebrating standout German series.",
    },

    # III. Global TV Festivals & European/Latin Honors (21–30)
    "series_mania": {
        "id": "series_mania",
        "name": "Series Mania Festival – Grand Prize",
        "shortName": "Series Mania",
        "awardName": "International Competition Grand Prize",
        "wikidataId": "Q16678186",
        "country": "France",
        "city": "Lille",
        "founded": 2010,
        "icon": "film-outline",
        "badgeColor": "#A855F7",
        "mediaType": "tv",
        "description": "Europe's largest festival dedicated exclusively to international television series premieres.",
    },
    "canneseries": {
        "id": "canneseries",
        "name": "Canneseries (Cannes International Series Festival)",
        "shortName": "Canneseries",
        "awardName": "Best Series (Meilleure Série)",
        "wikidataId": "Q51530879",
        "country": "France",
        "city": "Cannes",
        "founded": 2018,
        "icon": "ribbon-outline",
        "badgeColor": "#EC4899",
        "mediaType": "tv",
        "description": "Showcasing bold, visionary new television series from around the globe on the French Riviera.",
    },
    "acs_france": {
        "id": "acs_france",
        "name": "Association des Critiques de Séries (ACS) Awards",
        "shortName": "ACS France",
        "awardName": "Meilleure Série (Best French Series)",
        "wikidataId": "Q24938605",
        "country": "France",
        "city": "Paris",
        "founded": 2015,
        "icon": "newspaper-outline",
        "badgeColor": "#3B82F6",
        "mediaType": "tv",
        "description": "The French television critics association's top honor for contemporary French series craft.",
    },
    "rose_dor": {
        "id": "rose_dor",
        "name": "Rose d'Or Awards (European Broadcasting Union)",
        "shortName": "Rose d'Or",
        "awardName": "Golden Rose for Best Drama & Comedy",
        "wikidataId": "Q686236",
        "country": "Europe",
        "city": "London / Lucerne",
        "founded": 1961,
        "icon": "rose-outline",
        "badgeColor": "#F43F5E",
        "mediaType": "tv",
        "description": "One of Europe's most storied international television honors, celebrating originality and excellence in broadcasting.",
    },
    "monte_carlo_tv": {
        "id": "monte_carlo_tv",
        "name": "Monte-Carlo Television Festival – Golden Nymph",
        "shortName": "Monte-Carlo",
        "awardName": "Golden Nymph (Nymphe d'Or) for Best TV Series",
        "wikidataId": "Q608297",
        "country": "Monaco",
        "city": "Monte Carlo",
        "founded": 1961,
        "icon": "star-outline",
        "badgeColor": "#EAB308",
        "mediaType": "tv",
        "description": "Founded by Prince Rainier III of Monaco to honor international artistic achievement in television.",
    },
    "banff_rockie": {
        "id": "banff_rockie",
        "name": "Banff World Media Festival – Rockie Awards",
        "shortName": "Banff Rockie",
        "awardName": "Rockie Award Grand Jury Prize & Best Series",
        "wikidataId": "Q806445",
        "country": "Canada",
        "city": "Banff",
        "founded": 1979,
        "icon": "prism-outline",
        "badgeColor": "#0EA5E9",
        "mediaType": "tv",
        "description": "Recognizing the world's finest international television programs in the Canadian Rockies.",
    },
    "premios_feroz_tv": {
        "id": "premios_feroz_tv",
        "name": "Premios Feroz – Mejor Serie Dramática",
        "shortName": "Premios Feroz",
        "awardName": "Best Drama & Comedy Series (Spain)",
        "wikidataId": "Q15630754",
        "country": "Spain",
        "city": "Madrid",
        "founded": 2017,
        "icon": "paw-outline",
        "badgeColor": "#D97706",
        "mediaType": "tv",
        "description": "Voted by the Association of Cinematographic Informers of Spain to honor daring Spanish television.",
    },
    "premios_ondas_tv": {
        "id": "premios_ondas_tv",
        "name": "Premios Ondas – Mejor Serie Española",
        "shortName": "Premios Ondas",
        "awardName": "Ondas Award for Best Spanish Drama & Comedy",
        "wikidataId": "Q1895252",
        "country": "Spain",
        "city": "Barcelona",
        "founded": 1954,
        "icon": "radio-outline",
        "badgeColor": "#EA580C",
        "mediaType": "tv",
        "description": "Spain's longest-running and most respected broadcasting and television awards.",
    },
    "premios_platino_tv": {
        "id": "premios_platino_tv",
        "name": "Premios Platino – Best Ibero-American Series",
        "shortName": "Premios Platino",
        "awardName": "Mejor Miniserie o Teleserie Cinematográfica",
        "wikidataId": "Q16621763",
        "country": "Ibero-America",
        "city": "Madrid / Punta del Este",
        "founded": 2017,
        "icon": "globe-outline",
        "badgeColor": "#F59E0B",
        "mediaType": "tv",
        "description": "Uniting Latin America, Spain, and Portugal to celebrate the pinnacle of Spanish and Portuguese-language television.",
    },
    "nastri_dargento_serie": {
        "id": "nastri_dargento_serie",
        "name": "Nastri d'Argento Grandi Serie (Italy)",
        "shortName": "Nastri d'Argento",
        "awardName": "Miglior Serie TV (Best Italian Series)",
        "wikidataId": "Q107391502",
        "country": "Italy",
        "city": "Naples / Rome",
        "founded": 2021,
        "icon": "ribbon-outline",
        "badgeColor": "#14B8A6",
        "mediaType": "tv",
        "description": "Presented by the Italian National Syndicate of Film Journalists for outstanding Italian serialized drama.",
    },

    # IV. Asian Television Honors, Guilds, Critics & Genre (31–40)
    "baeksang_tv_drama": {
        "id": "baeksang_tv_drama",
        "name": "Baeksang Arts Awards – Best Drama (TV)",
        "shortName": "Baeksang TV",
        "awardName": "Best Drama (TV 부문 작품상)",
        "wikidataId": "Q12597754",
        "country": "South Korea",
        "city": "Seoul",
        "founded": 1975,
        "icon": "crown-outline",
        "badgeColor": "#2563EB",
        "mediaType": "tv",
        "description": "South Korea's most prestigious comprehensive arts award, crowning the defining K-Dramas of each era.",
    },
    "blue_dragon_series": {
        "id": "blue_dragon_series",
        "name": "Blue Dragon Series Awards – Best Drama",
        "shortName": "Blue Dragon Series",
        "awardName": "Best Drama & Daesang (최우수 작품상)",
        "wikidataId": "Q113148283",
        "country": "South Korea",
        "city": "Incheon",
        "founded": 2022,
        "icon": "shield-outline",
        "badgeColor": "#0284C7",
        "mediaType": "tv",
        "description": "Korea's premier streaming series awards honoring original Korean dramas across global platforms.",
    },
    "seoul_drama_awards": {
        "id": "seoul_drama_awards",
        "name": "Seoul International Drama Awards",
        "shortName": "Seoul Drama",
        "awardName": "Grand Prize (Daesang) & Golden Bird Prize",
        "wikidataId": "Q492284",
        "country": "South Korea",
        "city": "Seoul",
        "founded": 2006,
        "icon": "earth-outline",
        "badgeColor": "#9333EA",
        "mediaType": "tv",
        "description": "An international festival bringing together television dramas from over 60 countries in Seoul.",
    },
    "tokyo_drama_awards": {
        "id": "tokyo_drama_awards",
        "name": "Tokyo Drama Awards (International Drama Festival)",
        "shortName": "Tokyo Drama",
        "awardName": "Grand Prix for Continuous Drama (作品賞・グランプリ)",
        "wikidataId": "Q11524683",
        "country": "Japan",
        "city": "Tokyo",
        "founded": 2008,
        "icon": "sparkles-outline",
        "badgeColor": "#EF4444",
        "mediaType": "tv",
        "description": "Japan's flagship television drama honors recognizing artistic and international excellence in Japanese series.",
    },
    "golden_bell_tv": {
        "id": "golden_bell_tv",
        "name": "Golden Bell Awards – Best Television Series",
        "shortName": "Golden Bell",
        "awardName": "Best Television Series (戲劇節目獎)",
        "wikidataId": "Q715258",
        "country": "Taiwan",
        "city": "Taipei",
        "founded": 1965,
        "icon": "notifications-outline",
        "badgeColor": "#D97706",
        "mediaType": "tv",
        "description": "Taiwan's highest television honor, analogous to the Emmys for Mandarin and Taiwanese-language series.",
    },
    "critics_choice_tv": {
        "id": "critics_choice_tv",
        "name": "Critics' Choice Television Awards",
        "shortName": "Critics' Choice TV",
        "awardName": "Best Drama & Comedy Series",
        "wikidataId": "Q3002949",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 2011,
        "icon": "newspaper-outline",
        "badgeColor": "#8B5CF6",
        "mediaType": "tv",
        "description": "Presented by the Critics Choice Association to honor the most critically acclaimed television series in North America.",
    },
    "tca_program_of_year": {
        "id": "tca_program_of_year",
        "name": "Television Critics Association (TCA) Awards",
        "shortName": "TCA Awards",
        "awardName": "Program of the Year",
        "wikidataId": "Q3512056",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 1985,
        "icon": "ribbon-outline",
        "badgeColor": "#10B981",
        "mediaType": "tv",
        "description": "Voted by over 200 North American television critics to crown the single most defining TV program of each season.",
    },
    "sag_tv_drama": {
        "id": "sag_tv_drama",
        "name": "Screen Actors Guild (SAG) Awards – Drama & Comedy Ensemble",
        "shortName": "SAG TV Ensemble",
        "awardName": "Outstanding Performance by an Ensemble in a Series",
        "wikidataId": "Q2465558",
        "country": "United States",
        "city": "Los Angeles",
        "founded": 1995,
        "icon": "people-outline",
        "badgeColor": "#C5A059",
        "mediaType": "tv",
        "description": "Peer-voted by SAG-AFTRA actors to recognize extraordinary collective ensemble acting in television.",
    },
    "wga_pga_tv_drama": {
        "id": "wga_pga_tv_drama",
        "name": "Writers Guild (WGA) & Producers Guild (PGA) TV Honors",
        "shortName": "WGA & PGA TV",
        "awardName": "Best Dramatic & Episodic Series",
        "wikidataId": "Q8038462",
        "country": "United States",
        "city": "Los Angeles / New York",
        "founded": 1949,
        "icon": "create-outline",
        "badgeColor": "#4F46E5",
        "mediaType": "tv",
        "description": "Industry guild honors celebrating masterwork television writing and producing.",
    },
    "annecy_annie_tv_animation": {
        "id": "annecy_annie_tv_animation",
        "name": "Annecy Festival & Annie Awards – Animated Series",
        "shortName": "Annecy & Annie TV",
        "awardName": "Cristal for a TV Production & Best Animated Series",
        "wikidataId": "Q2851672",
        "country": "France / United States",
        "city": "Annecy / Los Angeles",
        "founded": 1960,
        "icon": "color-wand-outline",
        "badgeColor": "#F97316",
        "mediaType": "tv",
        "description": "The combined global standard of excellence in international animated series from Annecy and ASIFA-Hollywood.",
    },
}

# Curated historical archives per ceremony: (award_year, title, original_title, first_air_year_hint)
HISTORICAL_TV_WINNERS = {
    "emmy_drama": [
        ("2024", "Shōgun", "Shōgun", "2024"),
        ("2023", "Succession", "", "2018"),
        ("2022", "Succession", "", "2018"),
        ("2021", "The Crown", "", "2016"),
        ("2020", "Succession", "", "2018"),
        ("2019", "Game of Thrones", "", "2011"),
        ("2018", "Game of Thrones", "", "2011"),
        ("2017", "The Handmaid's Tale", "", "2017"),
        ("2016", "Game of Thrones", "", "2011"),
        ("2015", "Game of Thrones", "", "2011"),
        ("2014", "Breaking Bad", "", "2008"),
        ("2013", "Breaking Bad", "", "2008"),
        ("2012", "Homeland", "", "2011"),
        ("2011", "Mad Men", "", "2007"),
        ("2010", "Mad Men", "", "2007"),
        ("2009", "Mad Men", "", "2007"),
        ("2008", "Mad Men", "", "2007"),
        ("2007", "The Sopranos", "", "1999"),
        ("2006", "24", "", "2001"),
        ("2005", "Lost", "", "2004"),
        ("2004", "The Sopranos", "", "1999"),
        ("2003", "The West Wing", "", "1999"),
        ("2002", "The West Wing", "", "1999"),
        ("2001", "The West Wing", "", "1999"),
        ("2000", "The West Wing", "", "1999"),
        ("1999", "The Practice", "", "1997"),
        ("1998", "The Practice", "", "1997"),
        ("1997", "Law & Order", "", "1990"),
        ("1996", "ER", "", "1994"),
        ("1995", "NYPD Blue", "", "1993"),
        ("1994", "Picket Fences", "", "1992"),
        ("1992", "Northern Exposure", "", "1990"),
        ("1990", "L.A. Law", "", "1986"),
        ("1988", "thirtysomething", "", "1987"),
        ("1985", "Cagney & Lacey", "", "1981"),
        ("1981", "Hill Street Blues", "", "1981"),
        ("1978", "The Rockford Files", "", "1974"),
        ("1977", "Upstairs, Downstairs", "", "1971"),
        ("1973", "The Waltons", "", "1972"),
        ("1967", "Mission: Impossible", "", "1966"),
        ("1966", "The Fugitive", "", "1963"),
        ("1962", "The Defenders", "", "1961"),
    ],
    "emmy_comedy": [
        ("2024", "Hacks", "", "2021"),
        ("2023", "The Bear", "", "2022"),
        ("2022", "Ted Lasso", "", "2020"),
        ("2021", "Ted Lasso", "", "2020"),
        ("2020", "Schitt's Creek", "", "2015"),
        ("2019", "Fleabag", "", "2016"),
        ("2018", "The Marvelous Mrs. Maisel", "", "2017"),
        ("2017", "Veep", "", "2012"),
        ("2016", "Veep", "", "2012"),
        ("2015", "Veep", "", "2012"),
        ("2014", "Modern Family", "", "2009"),
        ("2013", "Modern Family", "", "2009"),
        ("2012", "Modern Family", "", "2009"),
        ("2011", "Modern Family", "", "2009"),
        ("2010", "Modern Family", "", "2009"),
        ("2009", "30 Rock", "", "2006"),
        ("2008", "30 Rock", "", "2006"),
        ("2007", "30 Rock", "", "2006"),
        ("2006", "The Office", "", "2005"),
        ("2005", "Everybody Loves Raymond", "", "1996"),
        ("2004", "Arrested Development", "", "2003"),
        ("2002", "Friends", "", "1994"),
        ("2001", "Sex and the City", "", "1998"),
        ("2000", "Will & Grace", "", "1998"),
        ("1999", "Ally McBeal", "", "1997"),
        ("1998", "Frasier", "", "1993"),
        ("1993", "Seinfeld", "", "1989"),
        ("1992", "Murphy Brown", "", "1988"),
        ("1991", "Cheers", "", "1982"),
        ("1988", "The Wonder Years", "", "1988"),
        ("1986", "The Golden Girls", "", "1985"),
        ("1985", "The Cosby Show", "", "1984"),
        ("1979", "Taxi", "", "1978"),
        ("1975", "The Mary Tyler Moore Show", "", "1970"),
        ("1974", "M*A*S*H", "", "1972"),
        ("1971", "All in the Family", "", "1971"),
        ("1966", "The Dick Van Dyke Show", "", "1961"),
        ("1953", "I Love Lucy", "", "1951"),
    ],
    "emmy_limited": [
        ("2024", "Baby Reindeer", "", "2024"),
        ("2023", "Beef", "", "2023"),
        ("2022", "The White Lotus", "", "2021"),
        ("2021", "The Queen's Gambit", "", "2020"),
        ("2020", "Watchmen", "", "2019"),
        ("2019", "Chernobyl", "", "2019"),
        ("2018", "The Assassination of Gianni Versace: American Crime Story", "", "2016"),
        ("2017", "Big Little Lies", "", "2017"),
        ("2016", "The People v. O. J. Simpson: American Crime Story", "", "2016"),
        ("2015", "Olive Kitteridge", "", "2014"),
        ("2014", "Fargo", "", "2014"),
        ("2012", "Hatfields & McCoys", "", "2012"),
        ("2011", "Downton Abbey", "", "2010"),
        ("2010", "The Pacific", "", "2010"),
        ("2008", "John Adams", "", "2008"),
        ("2006", "Elizabeth I", "", "2005"),
        ("2004", "Angels in America", "", "2003"),
        ("2002", "Band of Brothers", "", "2001"),
        ("2000", "The Corner", "", "2000"),
        ("1998", "From the Earth to the Moon", "", "1998"),
        ("1995", "Prime Suspect", "", "1991"),
        ("1985", "The Jewel in the Crown", "", "1984"),
        ("1977", "Roots", "", "1977"),
    ],
    "emmy_animation": [
        ("2024", "Blue Eye Samurai", "", "2023"),
        ("2023", "The Simpsons", "", "1989"),
        ("2022", "Arcane", "", "2021"),
        ("2021", "Genndy Tartakovsky's Primal", "", "2019"),
        ("2020", "Rick and Morty", "", "2013"),
        ("2018", "Rick and Morty", "", "2013"),
        ("2017", "Bob's Burgers", "", "2011"),
        ("2016", "Archer", "", "2009"),
        ("2015", "Over the Garden Wall", "", "2014"),
        ("2013", "South Park", "", "1997"),
        ("2010", "Futurama", "", "1999"),
        ("2008", "Avatar: The Last Airbender", "", "2005"),
        ("2004", "Samurai Jack", "", "2001"),
        ("2002", "Futurama", "", "1999"),
        ("1999", "King of the Hill", "", "1997"),
        ("1995", "Pinky and the Brain", "", "1995"),
        ("1993", "Batman: The Animated Series", "", "1992"),
        ("1990", "The Simpsons", "", "1989"),
    ],
    "gg_tv_drama": [
        ("2025", "Shōgun", "Shōgun", "2024"),
        ("2024", "Succession", "", "2018"),
        ("2023", "House of the Dragon", "", "2022"),
        ("2022", "Succession", "", "2018"),
        ("2021", "The Crown", "", "2016"),
        ("2020", "Succession", "", "2018"),
        ("2019", "The Americans", "", "2013"),
        ("2018", "The Handmaid's Tale", "", "2017"),
        ("2017", "The Crown", "", "2016"),
        ("2016", "Mr. Robot", "", "2015"),
        ("2015", "The Affair", "", "2014"),
        ("2014", "Breaking Bad", "", "2008"),
        ("2013", "Homeland", "", "2011"),
        ("2012", "Homeland", "", "2011"),
        ("2011", "Boardwalk Empire", "", "2010"),
        ("2010", "Mad Men", "", "2007"),
        ("2009", "Mad Men", "", "2007"),
        ("2008", "Mad Men", "", "2007"),
        ("2007", "Grey's Anatomy", "", "2005"),
        ("2006", "Lost", "", "2004"),
        ("2005", "Nip/Tuck", "", "2003"),
        ("2004", "24", "", "2001"),
        ("2003", "The Shield", "", "2002"),
        ("2002", "Six Feet Under", "", "2001"),
        ("2001", "The West Wing", "", "1999"),
        ("2000", "The Sopranos", "", "1999"),
        ("1997", "The X-Files", "", "1993"),
        ("1995", "Party of Five", "", "1994"),
        ("1991", "Twin Peaks", "", "1990"),
    ],
    "gg_tv_comedy": [
        ("2025", "Hacks", "", "2021"),
        ("2024", "The Bear", "", "2022"),
        ("2023", "Abbott Elementary", "", "2021"),
        ("2022", "Hacks", "", "2021"),
        ("2021", "Schitt's Creek", "", "2015"),
        ("2020", "Fleabag", "", "2016"),
        ("2019", "The Kominsky Method", "", "2018"),
        ("2018", "The Marvelous Mrs. Maisel", "", "2017"),
        ("2017", "Atlanta", "", "2016"),
        ("2016", "Mozart in the Jungle", "", "2014"),
        ("2015", "Transparent", "", "2014"),
        ("2014", "Brooklyn Nine-Nine", "", "2013"),
        ("2013", "Girls", "", "2012"),
        ("2012", "Modern Family", "", "2009"),
        ("2010", "Glee", "", "2009"),
        ("2009", "30 Rock", "", "2006"),
        ("2008", "Extras", "", "2005"),
        ("2007", "Ugly Betty", "", "2006"),
        ("2005", "Desperate Housewives", "", "2004"),
        ("2004", "The Office", "", "2001"),
        ("2003", "Curb Your Enthusiasm", "", "2000"),
        ("2000", "Sex and the City", "", "1998"),
        ("1994", "Seinfeld", "", "1989"),
        ("1991", "Cheers", "", "1982"),
    ],
    "gg_tv_limited": [
        ("2025", "Baby Reindeer", "", "2024"),
        ("2024", "Beef", "", "2023"),
        ("2023", "The White Lotus", "", "2021"),
        ("2022", "The Underground Railroad", "", "2021"),
        ("2021", "The Queen's Gambit", "", "2020"),
        ("2020", "Chernobyl", "", "2019"),
        ("2018", "Big Little Lies", "", "2017"),
        ("2017", "The People v. O. J. Simpson: American Crime Story", "", "2016"),
        ("2016", "Wolf Hall", "", "2015"),
        ("2015", "Fargo", "", "2014"),
        ("2012", "Downton Abbey", "", "2010"),
        ("2011", "Carlos", "", "2010"),
        ("2009", "John Adams", "", "2008"),
        ("2004", "Angels in America", "", "2003"),
        ("2002", "Band of Brothers", "", "2001"),
        ("1989", "Lonesome Dove", "", "1989"),
    ],
    "peabody_tv": [
        ("2024", "Reservation Dogs", "", "2021"),
        ("2024", "The Bear", "", "2022"),
        ("2024", "Bluey", "", "2018"),
        ("2023", "Andor", "", "2022"),
        ("2023", "Severance", "", "2022"),
        ("2023", "Bad Sisters", "", "2022"),
        ("2023", "Mo", "", "2022"),
        ("2022", "Hacks", "", "2021"),
        ("2022", "Dopesick", "", "2021"),
        ("2022", "Sort Of", "", "2021"),
        ("2021", "I May Destroy You", "", "2020"),
        ("2021", "Small Axe", "", "2020"),
        ("2021", "Ted Lasso", "", "2020"),
        ("2020", "Succession", "", "2018"),
        ("2020", "Fleabag", "", "2016"),
        ("2020", "Chernobyl", "", "2019"),
        ("2020", "Watchmen", "", "2019"),
        ("2019", "Barry", "", "2018"),
        ("2019", "Pose", "", "2018"),
        ("2019", "Killing Eve", "", "2018"),
        ("2018", "The Handmaid's Tale", "", "2017"),
        ("2018", "Better Call Saul", "", "2015"),
        ("2017", "Atlanta", "", "2016"),
        ("2016", "Mr. Robot", "", "2015"),
        ("2016", "The Leftovers", "", "2014"),
        ("2015", "Fargo", "", "2014"),
        ("2015", "The Americans", "", "2013"),
        ("2014", "Breaking Bad", "", "2008"),
        ("2004", "The Wire", "", "2002"),
        ("2000", "The Sopranos", "", "1999"),
        ("1991", "Twin Peaks", "", "1990"),
    ],
    "afi_tv": [
        ("2024", "Shōgun", "Shōgun", "2024"),
        ("2024", "The Penguin", "", "2024"),
        ("2024", "Hacks", "", "2021"),
        ("2023", "Succession", "", "2018"),
        ("2023", "The Bear", "", "2022"),
        ("2023", "Beef", "", "2023"),
        ("2023", "The Last of Us", "", "2023"),
        ("2023", "Poker Face", "", "2023"),
        ("2022", "Severance", "", "2022"),
        ("2022", "Better Call Saul", "", "2015"),
        ("2022", "The White Lotus", "", "2021"),
        ("2022", "Pachinko", "", "2022"),
        ("2021", "Mare of Easttown", "", "2021"),
        ("2021", "Succession", "", "2018"),
        ("2020", "The Queen's Gambit", "", "2020"),
        ("2020", "The Mandalorian", "", "2019"),
        ("2019", "Chernobyl", "", "2019"),
        ("2019", "Watchmen", "", "2019"),
        ("2018", "The Americans", "", "2013"),
        ("2018", "Atlanta", "", "2016"),
        ("2016", "Stranger Things", "", "2016"),
        ("2015", "Mad Men", "", "2007"),
        ("2013", "Breaking Bad", "", "2008"),
        ("2008", "The Wire", "", "2002"),
        ("2007", "The Sopranos", "", "1999"),
    ],
    "intl_emmy_drama": [
        ("2024", "Drops of God", "Les Gouttes de Dieu", "2023"),
        ("2023", "The Empress", "Die Kaiserin", "2022"),
        ("2022", "Vigil", "", "2021"),
        ("2021", "Tehran", "טהרן", "2020"),
        ("2020", "Delhi Crime", "", "2019"),
        ("2019", "McMafia", "", "2018"),
        ("2018", "Money Heist", "La casa de papel", "2017"),
        ("2017", "Mammon", "", "2014"),
        ("2016", "Deutschland 83", "", "2015"),
        ("2015", "Spiral", "Engrenages", "2005"),
        ("2014", "Utopia", "", "2013"),
        ("2013", "The Returned", "Les Revenants", "2012"),
        ("2012", "Braquo", "", "2009"),
        ("2011", "Accused", "", "2010"),
        ("2010", "The Street", "", "2006"),
        ("2009", "The Protectors", "Livvagterne", "2009"),
        ("2008", "Life on Mars", "", "2006"),
        ("2006", "Life on Mars", "", "2006"),
        ("2005", "The Eagle", "Ørnen", "2004"),
        ("2003", "Nikolaj and Julie", "Nikolaj og Julie", "2002"),
        ("2002", "Unit One", "Rejseholdet", "2000"),
    ],
    "intl_emmy_comedy": [
        ("2024", "División Palermo", "", "2023"),
        ("2023", "Derry Girls", "", "2018"),
        ("2022", "Sex Education", "", "2019"),
        ("2021", "Call My Agent!", "Dix pour cent", "2015"),
        ("2020", "Ninguém Tá Olhando", "", "2019"),
        ("2019", "Especial de Natal Porta dos Fundos", "", "2018"),
        ("2018", "Nevsu", "", "2017"),
        ("2017", "Alan Partridge's Scissored Isle", "", "2016"),
        ("2016", "Hoff the Record", "", "2015"),
        ("2014", "Wat als?", "", "2011"),
        ("2013", "Moone Boy", "", "2012"),
        ("2012", "The Invisible Woman", "A Mulher Invisível", "2011"),
        ("2010", "Traffic Light", "Ramzor", "2008"),
        ("2008", "The IT Crowd", "", "2006"),
        ("2007", "Little Britain Abroad", "", "2006"),
        ("2006", "Little Britain", "", "2003"),
    ],
    "bafta_tv_drama": [
        ("2024", "Top Boy", "", "2011"),
        ("2023", "Bad Sisters", "", "2022"),
        ("2022", "In My Skin", "", "2018"),
        ("2021", "Save Me", "", "2018"),
        ("2020", "The End of the F***ing World", "", "2017"),
        ("2019", "Killing Eve", "", "2018"),
        ("2018", "Peaky Blinders", "", "2013"),
        ("2017", "Happy Valley", "", "2014"),
        ("2016", "Wolf Hall", "", "2015"),
        ("2015", "Happy Valley", "", "2014"),
        ("2014", "Broadchurch", "", "2013"),
        ("2013", "Last Tango in Halifax", "", "2012"),
        ("2012", "The Fades", "", "2011"),
        ("2011", "Sherlock", "", "2010"),
        ("2010", "Misfits", "", "2009"),
        ("2008", "The Street", "", "2006"),
        ("2007", "The Street", "", "2006"),
        ("2006", "Doctor Who", "", "2005"),
        ("2004", "Buried", "", "2003"),
        ("2003", "Spooks", "", "2002"),
        ("1996", "Cracker", "", "1993"),
        ("1993", "Inspector Morse", "", "1987"),
    ],
    "bafta_tv_comedy": [
        ("2024", "Such Brave Girls", "", "2023"),
        ("2023", "Derry Girls", "", "2018"),
        ("2022", "Motherland", "", "2016"),
        ("2021", "Inside No. 9", "", "2014"),
        ("2020", "Stath Lets Flats", "", "2018"),
        ("2019", "Sally4Ever", "", "2018"),
        ("2018", "This Country", "", "2017"),
        ("2017", "People Just Do Nothing", "", "2014"),
        ("2016", "Peter Kay's Car Share", "", "2015"),
        ("2015", "Detectorists", "", "2014"),
        ("2014", "Him & Her", "", "2010"),
        ("2013", "Twenty Twelve", "", "2011"),
        ("2010", "The Thick of It", "", "2005"),
        ("2009", "The IT Crowd", "", "2006"),
        ("2008", "Peep Show", "", "2003"),
        ("2004", "The Office", "", "2001"),
        ("2001", "Black Books", "", "2000"),
        ("1999", "Father Ted", "", "1995"),
        ("1995", "Three Lions", "Absolutely Fabulous", "1992"),
        ("1990", "Blackadder", "", "1983"),
        ("1982", "Only Fools and Horses", "", "1981"),
        ("1980", "Fawlty Towers", "", "1975"),
    ],
    "bafta_tv_miniseries": [
        ("2024", "The Sixth Commandment", "", "2023"),
        ("2023", "Mood", "", "2022"),
        ("2022", "Time", "", "2021"),
        ("2021", "I May Destroy You", "", "2020"),
        ("2020", "Chernobyl", "", "2019"),
        ("2019", "Patrick Melrose", "", "2018"),
        ("2018", "Three Girls", "", "2017"),
        ("2017", "National Treasure", "", "2016"),
        ("2016", "This Is England '90", "", "2015"),
        ("2015", "The Lost Honour of Christopher Jefferies", "", "2014"),
        ("2014", "In the Flesh", "", "2013"),
        ("2012", "This Is England '88", "", "2011"),
        ("2011", "Any Human Heart", "", "2010"),
        ("2009", "Criminal Justice", "", "2008"),
        ("2005", "Sex Traffic", "", "2004"),
        ("2004", "State of Play", "", "2003"),
    ],
    "bafta_tv_international": [
        ("2024", "Class Act", "Tapie", "2023"),
        ("2023", "Dahmer – Monster: The Jeffrey Dahmer Story", "", "2022"),
        ("2022", "The Underground Railroad", "", "2021"),
        ("2021", "Welcome to Chechnya", "", "2020"),
        ("2020", "When They See Us", "", "2019"),
        ("2019", "Succession", "", "2018"),
        ("2018", "The Handmaid's Tale", "", "2017"),
        ("2017", "The People v. O. J. Simpson: American Crime Story", "", "2016"),
        ("2016", "Transparent", "", "2014"),
        ("2015", "True Detective", "", "2014"),
        ("2014", "Breaking Bad", "", "2008"),
        ("2013", "Girls", "", "2012"),
        ("2012", "Borgen", "", "2010"),
        ("2011", "The Killing", "Forbrydelsen", "2007"),
        ("2010", "Mad Men", "", "2007"),
        ("2009", "Mad Men", "", "2007"),
        ("2008", "Heroes", "", "2006"),
    ],
    "rts_drama": [
        ("2024", "Happy Valley", "", "2014"),
        ("2023", "Sherwood", "", "2022"),
        ("2022", "In My Skin", "", "2018"),
        ("2021", "Save Me", "", "2018"),
        ("2020", "The Capture", "", "2019"),
        ("2019", "Save Me", "", "2018"),
        ("2018", "The End of the F***ing World", "", "2017"),
        ("2017", "Happy Valley", "", "2014"),
        ("2016", "No Offence", "", "2015"),
        ("2015", "Line of Duty", "", "2012"),
        ("2014", "Peaky Blinders", "", "2013"),
        ("2013", "The Hollow Crown", "", "2012"),
        ("2012", "Luther", "", "2010"),
        ("2011", "Sherlock", "", "2010"),
        ("2008", "The Street", "", "2006"),
        ("2006", "Bodies", "", "2004"),
        ("2005", "Shameless", "", "2004"),
    ],
    "canadian_screen_tv": [
        ("2024", "Little Bird", "", "2023"),
        ("2023", "The Porter", "", "2022"),
        ("2022", "Transplant", "", "2020"),
        ("2021", "Transplant", "", "2020"),
        ("2020", "Cardinal", "", "2017"),
        ("2019", "Anne with an E", "", "2017"),
        ("2018", "Anne with an E", "", "2017"),
        ("2017", "Orphan Black", "", "2013"),
        ("2016", "19-2", "", "2014"),
        ("2015", "Orphan Black", "", "2013"),
        ("2014", "Orphan Black", "", "2013"),
        ("2013", "Flashpoint", "", "2008"),
        ("2011", "The Borgias", "", "2011"),
        ("2010", "The Tudors", "", "2007"),
        ("2006", "Slings & Arrows", "", "2003"),
        ("2004", "Da Vinci's Inquest", "", "1998"),
        ("1996", "Due South", "", "1994"),
    ],
    "aacta_tv_drama": [
        ("2024", "The Newsreader", "", "2021"),
        ("2023", "Mystery Road: Origin", "", "2022"),
        ("2022", "The Newsreader", "", "2021"),
        ("2020", "Mystery Road", "", "2018"),
        ("2019", "Total Control", "", "2019"),
        ("2018", "Mystery Road", "", "2018"),
        ("2017", "Top of the Lake", "", "2013"),
        ("2016", "Wentworth", "", "2013"),
        ("2015", "Glitch", "", "2015"),
        ("2014", "The Code", "", "2014"),
        ("2013", "Redfern Now", "", "2012"),
        ("2012", "The Slap", "", "2011"),
        ("2010", "Rush", "", "2008"),
        ("2008", "Underbelly", "", "2008"),
        ("2005", "Love My Way", "", "2004"),
    ],
    "grimme_preis": [
        ("2024", "Die Zweiflers", "", "2024"),
        ("2023", "Kleo", "", "2022"),
        ("2022", "Faking Hitler", "", "2021"),
        ("2021", "Unorthodox", "", "2020"),
        ("2020", "Der Pass", "", "2018"),
        ("2019", "Bad Banks", "", "2018"),
        ("2018", "Dark", "", "2017"),
        ("2018", "Babylon Berlin", "", "2017"),
        ("2018", "4 Blocks", "", "2017"),
        ("2016", "Deutschland 83", "", "2015"),
        ("2015", "Tatortreiniger", "Der Tatortreiniger", "2011"),
        ("2014", "Generation War", "Unsere Mütter, unsere Väter", "2013"),
        ("2011", "In Face of Crime", "Im Angesicht des Verbrechens", "2010"),
        ("2006", "Stromberg", "", "2004"),
        ("2004", "Berlin, Berlin", "", "2002"),
        ("1985", "Heimat", "", "1984"),
    ],
    "deutscher_fernsehpreis": [
        ("2024", "Die Zweiflers", "", "2024"),
        ("2023", "Kleo", "", "2022"),
        ("2022", "Faking Hitler", "", "2021"),
        ("2021", "Para – Wir sind King", "", "2021"),
        ("2020", "Der Pass", "", "2018"),
        ("2019", "Bad Banks", "", "2018"),
        ("2018", "Babylon Berlin", "", "2017"),
        ("2017", "Club der roten Bänder", "", "2015"),
        ("2016", "Deutschland 83", "", "2015"),
        ("2014", "Danni Lowinski", "", "2010"),
        ("2013", "Generation War", "Unsere Mütter, unsere Väter", "2013"),
        ("2012", "The Last Cop", "Der letzte Bulle", "2010"),
        ("2011", "Doctor's Diary", "", "2008"),
        ("2010", "In Face of Crime", "Im Angesicht des Verbrechens", "2010"),
        ("2007", "Stromberg", "", "2004"),
    ],
    "series_mania": [
        ("2024", "Rematch", "", "2024"),
        ("2023", "The Actor", "Raha", "2023"),
        ("2022", "Le Monde de demain", "", "2022"),
        ("2021", "Blackport", "Verbúðin", "2021"),
        ("2019", "The Virtues", "", "2019"),
        ("2018", "On the Spectrum", "על הספקטרום", "2018"),
        ("2017", "Your Honor", "Kvodo", "2017"),
        ("2016", "El Marginal", "", "2016"),
        ("2015", "Deutschland 83", "", "2015"),
        ("2014", "Love & Anarchy", "", "2020"),
        ("2013", "Les Revenants", "", "2012"),
        ("2012", "Borgen", "", "2010"),
    ],
    "canneseries": [
        ("2024", "Die Zweiflers", "", "2024"),
        ("2023", "Power Play", "Makta", "2023"),
        ("2022", "TheLesson", "Shaa't Neila", "2022"),
        ("2021", "Mister 8", "", "2021"),
        ("2020", "Partisan", "", "2020"),
        ("2019", "Perfect Life", "Vida perfecta", "2019"),
        ("2018", "When Heroes Fly", "בשבילה גיבורים עפים", "2018"),
        ("2023", "Bargain", "몸값", "2022"),
        ("2022", "Audrey's Back", "Audrey est revenue", "2021"),
        ("2018", "State of Happiness", "Lykkeland", "2018"),
        ("2019", "Bauhaus - A New Era", "Die Neue Zeit", "2019"),
        ("2021", "About Saturday", "Kemmuna", "2021"),
    ],
    "acs_france": [
        ("2024", "Sambre", "Sambre", "2023"),
        ("2023", "Le Monde de demain", "", "2022"),
        ("2022", "Oussekine", "", "2022"),
        ("2021", "In Therapy", "En thérapie", "2021"),
        ("2020", "Mythomaniac", "Mytho", "2019"),
        ("2019", "Hippocrate", "", "2018"),
        ("2018", "The Bureau", "Le Bureau des Légendes", "2015"),
        ("2017", "The Bureau", "Le Bureau des Légendes", "2015"),
        ("2016", "Call My Agent!", "Dix pour cent", "2015"),
        ("2015", "P'tit Quinquin", "", "2014"),
        ("2017", "Baron Noir", "", "2016"),
        ("2015", "Spiral", "Engrenages", "2005"),
    ],
    "rose_dor": [
        ("2024", "Baby Reindeer", "", "2024"),
        ("2023", "The White Lotus", "", "2021"),
        ("2022", "Succession", "", "2018"),
        ("2021", "Normal People", "", "2020"),
        ("2020", "Chernobyl", "", "2019"),
        ("2019", "Arde Madrid", "", "2018"),
        ("2018", "Sins of the Fathers", "", "2018"),
        ("2016", "Fleabag", "", "2016"),
        ("2015", "Catastrophe", "", "2015"),
        ("2014", "Toast of London", "", "2012"),
        ("2013", "What Remains", "", "2013"),
        ("2012", "Friday Night Dinner", "", "2011"),
        ("2010", "The Inbetweeners", "", "2008"),
        ("2009", "The IT Crowd", "", "2006"),
        ("2006", "Extras", "", "2005"),
        ("2004", "Peep Show", "", "2003"),
        ("2002", "The Office", "", "2001"),
    ],
    "monte_carlo_tv": [
        ("2024", "The Gathering", "", "2024"),
        ("2023", "The Seed", "Der Schwarm", "2023"),
        ("2022", "The Tourist", "", "2022"),
        ("2021", "It's a Sin", "", "2021"),
        ("2019", "Escape at Dannemora", "", "2018"),
        ("2019", "My Brilliant Friend", "L'amica geniale", "2018"),
        ("2018", "Money Heist", "La casa de papel", "2017"),
        ("2017", "Victoria", "", "2016"),
        ("2016", "River", "", "2015"),
        ("2015", "Happy Valley", "", "2014"),
        ("2014", "Top of the Lake", "", "2013"),
        ("2013", "Breaking Bad", "", "2008"),
        ("2012", "Game of Thrones", "", "2011"),
        ("2011", "Mad Men", "", "2007"),
        ("2010", "Dexter", "", "2006"),
        ("2007", "Lost", "", "2004"),
    ],
    "banff_rockie": [
        ("2024", "The Bear", "", "2022"),
        ("2023", "The Last of Us", "", "2023"),
        ("2022", "Sort Of", "", "2021"),
        ("2021", "I May Destroy You", "", "2020"),
        ("2020", "Fleabag", "", "2016"),
        ("2019", "Chernobyl", "", "2019"),
        ("2018", "The Handmaid's Tale", "", "2017"),
        ("2017", "Stranger Things", "", "2016"),
        ("2016", "Fargo", "", "2014"),
        ("2015", "Orphan Black", "", "2013"),
        ("2014", "Breaking Bad", "", "2008"),
        ("2013", "Girls", "", "2012"),
        ("2012", "Game of Thrones", "", "2011"),
        ("2011", "Sherlock", "", "2010"),
        ("2010", "Big Love", "", "2006"),
    ],
    "premios_feroz_tv": [
        ("2024", "La Mesías", "", "2023"),
        ("2023", "The Route", "La ruta", "2022"),
        ("2022", "Cardo", "", "2021"),
        ("2021", "Riot Police", "Antidisturbios", "2020"),
        ("2020", "Hierro", "", "2019"),
        ("2019", "Cocaine Coast", "Fariña", "2018"),
        ("2019", "Arde Madrid", "", "2018"),
        ("2018", "La zona", "", "2017"),
        ("2017", "The Ministry of Time", "El ministerio del tiempo", "2015"),
        ("2017", "Paquita Salas", "", "2016"),
        ("2021", "Patria", "", "2020"),
        ("2020", "Perfect Life", "Vida perfecta", "2019"),
        ("2022", "Venga Juan", "", "2019"),
    ],
    "premios_ondas_tv": [
        ("2024", "La Mesías", "", "2023"),
        ("2023", "The Route", "La ruta", "2022"),
        ("2022", "Cardo", "", "2021"),
        ("2021", "Riot Police", "Antidisturbios", "2020"),
        ("2020", "Veneno", "", "2020"),
        ("2020", "Patria", "", "2020"),
        ("2019", "Hierro", "", "2019"),
        ("2018", "Cocaine Coast", "Fariña", "2018"),
        ("2018", "Paquita Salas", "", "2016"),
        ("2017", "Sé quién eres", "", "2017"),
        ("2016", "The Ministry of Time", "El ministerio del tiempo", "2015"),
        ("2015", "Locked Up", "Vis a vis", "2015"),
        ("2014", "Velvet", "", "2014"),
        ("2009", "Física o química", "", "2008"),
    ],
    "premios_platino_tv": [
        ("2024", "Barrabrava", "", "2023"),
        ("2023", "News of a Kidnapping", "Noticia de un secuestro", "2022"),
        ("2022", "The Kingdom", "El reino", "2021"),
        ("2021", "Patria", "", "2020"),
        ("2020", "Money Heist", "La casa de papel", "2017"),
        ("2019", "Arde Madrid", "", "2018"),
        ("2018", "The Ministry of Time", "El ministerio del tiempo", "2015"),
        ("2017", "Four Seasons in Havana", "Cuatro estaciones en La Habana", "2016"),
        ("2024", "One Hundred Years of Solitude", "Cien años de soledad", "2024"),
        ("2022", "Luis Miguel: The Series", "Luis Miguel: La serie", "2018"),
        ("2019", "Narcos: Mexico", "", "2018"),
        ("2018", "Un gallo para Esculapio", "", "2017"),
    ],
    "nastri_dargento_serie": [
        ("2024", "The Law According to Lidia Poët", "La legge di Lidia Poët", "2023"),
        ("2024", "Call My Agent - Italia", "", "2023"),
        ("2023", "Exterior Night", "Esterno notte", "2022"),
        ("2023", "The Sea Beyond", "Mare fuori", "2020"),
        ("2022", "My Brilliant Friend", "L'amica geniale", "2018"),
        ("2022", "Tear Along the Dotted Line", "Strappare lungo i bordi", "2021"),
        ("2021", "Gomorrah", "Gomorra - La serie", "2014"),
        ("2021", "Anna", "", "2021"),
        ("2021", "Suburra: Blood on Rome", "Suburra - La serie", "2017"),
        ("2022", "The Bad Guy", "", "2022"),
        ("2023", "Prisma", "", "2022"),
        ("2020", "The New Pope", "", "2020"),
    ],
    "baeksang_tv_drama": [
        ("2024", "My Dearest", "연인", "2023"),
        ("2023", "The Glory", "더 글로리", "2022"),
        ("2023", "Extraordinary Attorney Woo", "이상한 변호사 우영우", "2022"),
        ("2022", "D.P.", "디피", "2021"),
        ("2022", "Squid Game", "오징어 게임", "2021"),
        ("2021", "Beyond Evil", "괴물", "2021"),
        ("2020", "Hot Stove League", "스토브리그", "2019"),
        ("2020", "When the Camellia Blooms", "동백꽃 필 무렵", "2019"),
        ("2019", "My Mister", "나의 아저씨", "2018"),
        ("2018", "Mother", "마더", "2018"),
        ("2018", "Stranger", "비밀의 숲", "2017"),
        ("2017", "Dear My Friends", "디어 마이 프렌즈", "2016"),
        ("2017", "Guardian: The Lonely and Great God", "쓸쓸하고 찬란하神 - 도깨비", "2016"),
        ("2016", "Signal", "시그널", "2016"),
        ("2015", "Heard It Through the Grapevine", "풍문으로 들었소", "2015"),
        ("2014", "Good Doctor", "굿 닥터", "2013"),
        ("2012", "Moon Embracing the Sun", "해를 품은 달", "2012"),
        ("2011", "Secret Garden", "시크릿 가든", "2010"),
        ("2010", "Iris", "아이리스", "2009"),
    ],
    "blue_dragon_series": [
        ("2024", "Moving", "무빙", "2023"),
        ("2024", "Daily Dose of Sunshine", "정신병동에도 아침이 와요", "2023"),
        ("2023", "The Glory", "더 글로리", "2022"),
        ("2023", "Big Bet", "카지노", "2022"),
        ("2022", "D.P.", "디피", "2021"),
        ("2022", "Squid Game", "오징어 게임", "2021"),
        ("2023", "Weak Hero Class 1", "약한영웅 Class 1", "2022"),
        ("2024", "A Shop for Killers", "킬러들의 쇼핑몰", "2024"),
        ("2022", "Through the Darkness", "악의 마음을 읽는 자들", "2022"),
        ("2023", "Narco-Saints", "수리남", "2022"),
    ],
    "seoul_drama_awards": [
        ("2024", "Moving", "무빙", "2023"),
        ("2023", "The Fragile Colossus", "De Grâce", "2023"),
        ("2023", "Reborn Rich", "재벌집 막내아들", "2022"),
        ("2022", "Help", "", "2021"),
        ("2021", "Missing Child", "박하경 여행기", "2021"),
        ("2020", "Orphans of a Nation", "Órfãos da Terra", "2019"),
        ("2019", "On the Spectrum", "על הספקטרום", "2018"),
        ("2018", "Babylon Berlin", "", "2017"),
        ("2017", "This Is Us", "", "2016"),
        ("2016", "The Night Manager", "", "2016"),
        ("2016", "Descendants of the Sun", "태양의 후예", "2016"),
        ("2015", "Naked Among Wolves", "", "2015"),
        ("2014", "Kaboul Kitchen", "", "2012"),
        ("2014", "My Love from the Star", "별에서 온 그대", "2013"),
        ("2013", "Prisoners of War", "Hatufim", "2010"),
        ("2012", "Deep Rooted Tree", "뿌리깊은 나무", "2011"),
    ],
    "tokyo_drama_awards": [
        ("2024", "Vivant", "VIVANT", "2023"),
        ("2023", "Brush Up Life", "ブラッシュアップライフ", "2023"),
        ("2022", " Saiai", "最愛", "2021"),
        ("2021", "Story of My Family!!!", "俺の家の話", "2021"),
        ("2020", "Idaten: Tokyo Olympiad Story", "いだてん〜東京オリムピック噺〜", "2019"),
        ("2019", "Mr. Hiiragi's Homeroom", "3年A組 ―今から皆さんは、人質です―", "2019"),
        ("2018", "Ossan's Love", "おっさんずラブ", "2018"),
        ("2017", "The Full-Time Wife Escapist", "逃げるは恥だが役に立つ", "2016"),
        ("2016", "Here Comes Asa!", "あさが来た", "2015"),
        ("2015", "The Emperor's Cook", "天皇の料理番", "2015"),
        ("2014", "Hanzawa Naoki", "半沢直樹", "2013"),
        ("2013", "Amachan", "あまちゃん", "2013"),
        ("2012", "I'm Mita, Your Housekeeper", "家政婦のミタ", "2011"),
        ("2010", "Jin", "JIN-仁-", "2009"),
    ],
    "golden_bell_tv": [
        ("2024", "Living", "有生之年", "2023"),
        ("2024", "Port of Lies", "八尺門的辯護人", "2023"),
        ("2023", "Mad Doctor", "村裡來了個暴走女外科", "2022"),
        ("2022", "Seqalu: Formosa 1867", "斯卡羅", "2021"),
        ("2021", "The Magician on the Skywalk", "天橋上的魔術師", "2021"),
        ("2020", "Someday or One Day", "想見你", "2019"),
        ("2019", "The World Between Us", "我們與惡的距離", "2019"),
        ("2018", "A Boy Named Flora A", "花甲男孩轉大人", "2017"),
        ("2017", "Close Your Eyes Before It's Dark", "天黑請閉眼", "2016"),
        ("2016", "A Touch of Green", "一把青", "2015"),
        ("2015", "The Way We Were", "16個夏天", "2014"),
        ("2012", "In Time with You", "我可能不會愛你", "2011"),
        ("2009", "Black & White", "痞子英雄", "2009"),
    ],
    "critics_choice_tv": [
        ("2024", "Succession", "", "2018"),
        ("2024", "The Bear", "", "2022"),
        ("2024", "Beef", "", "2023"),
        ("2023", "Better Call Saul", "", "2015"),
        ("2023", "Abbott Elementary", "", "2021"),
        ("2022", "Succession", "", "2018"),
        ("2022", "Ted Lasso", "", "2020"),
        ("2021", "The Crown", "", "2016"),
        ("2020", "Succession", "", "2018"),
        ("2020", "Fleabag", "", "2016"),
        ("2019", "The Americans", "", "2013"),
        ("2019", "The Marvelous Mrs. Maisel", "", "2017"),
        ("2018", "The Handmaid's Tale", "", "2017"),
        ("2016", "Game of Thrones", "", "2011"),
        ("2016", "Silicon Valley", "", "2014"),
        ("2015", "The Americans", "", "2013"),
        ("2014", "Breaking Bad", "", "2008"),
        ("2013", "Breaking Bad", "", "2008"),
        ("2012", "Homeland", "", "2011"),
        ("2011", "Mad Men", "", "2007"),
    ],
    "tca_program_of_year": [
        ("2024", "Shōgun", "Shōgun", "2024"),
        ("2023", "Succession", "", "2018"),
        ("2022", "Abbott Elementary", "", "2021"),
        ("2021", "Ted Lasso", "", "2020"),
        ("2020", "Watchmen", "", "2019"),
        ("2019", "Fleabag", "", "2016"),
        ("2018", "The Americans", "", "2013"),
        ("2017", "The Handmaid's Tale", "", "2017"),
        ("2016", "The People v. O. J. Simpson: American Crime Story", "", "2016"),
        ("2015", "Empire", "", "2015"),
        ("2014", "Breaking Bad", "", "2008"),
        ("2013", "Breaking Bad", "", "2008"),
        ("2012", "Game of Thrones", "", "2011"),
        ("2011", "Friday Night Lights", "", "2006"),
        ("2010", "Glee", "", "2009"),
        ("2009", "Battlestar Galactica", "", "2004"),
        ("2008", "Mad Men", "", "2007"),
        ("2005", "Desperate Housewives", "", "2004"),
        ("2001", "The Sopranos", "", "1999"),
        ("2000", "The West Wing", "", "1999"),
        ("1999", "The Sopranos", "", "1999"),
        ("1990", "Twin Peaks", "", "1990"),
    ],
    "sag_tv_drama": [
        ("2024", "Succession", "", "2018"),
        ("2024", "The Bear", "", "2022"),
        ("2023", "The White Lotus", "", "2021"),
        ("2022", "Succession", "", "2018"),
        ("2021", "The Crown", "", "2016"),
        ("2020", "The Crown", "", "2016"),
        ("2019", "This Is Us", "", "2016"),
        ("2018", "This Is Us", "", "2016"),
        ("2017", "Stranger Things", "", "2016"),
        ("2016", "Downton Abbey", "", "2010"),
        ("2015", "Downton Abbey", "", "2010"),
        ("2014", "Breaking Bad", "", "2008"),
        ("2013", "Downton Abbey", "", "2010"),
        ("2012", "Boardwalk Empire", "", "2010"),
        ("2010", "Mad Men", "", "2007"),
        ("2009", "Mad Men", "", "2007"),
        ("2008", "The Sopranos", "", "1999"),
        ("2006", "Lost", "", "2004"),
        ("2004", "Six Feet Under", "", "2001"),
        ("2002", "The West Wing", "", "1999"),
        ("2000", "The Sopranos", "", "1999"),
        ("1996", "ER", "", "1994"),
    ],
    "wga_pga_tv_drama": [
        ("2024", "Succession", "", "2018"),
        ("2023", "Severance", "", "2022"),
        ("2022", "Succession", "", "2018"),
        ("2021", "The Crown", "", "2016"),
        ("2020", "Succession", "", "2018"),
        ("2019", "The Americans", "", "2013"),
        ("2018", "The Handmaid's Tale", "", "2017"),
        ("2017", "The Americans", "", "2013"),
        ("2016", "Mad Men", "", "2007"),
        ("2015", "True Detective", "", "2014"),
        ("2014", "Breaking Bad", "", "2008"),
        ("2013", "Breaking Bad", "", "2008"),
        ("2012", "Breaking Bad", "", "2008"),
        ("2011", "Mad Men", "", "2007"),
        ("2010", "Mad Men", "", "2007"),
        ("2009", "Mad Men", "", "2007"),
        ("2008", "The Wire", "", "2002"),
        ("2007", "The Sopranos", "", "1999"),
        ("2006", "Lost", "", "2004"),
    ],
    "annecy_annie_tv_animation": [
        ("2024", "Blue Eye Samurai", "", "2023"),
        ("2022", "Arcane", "", "2021"),
        ("2021", "Genndy Tartakovsky's Primal", "", "2019"),
        ("2020", "BoJack Horseman", "", "2014"),
        ("2019", "BoJack Horseman", "", "2014"),
        ("2018", "Rick and Morty", "", "2013"),
        ("2017", "Bob's Burgers", "", "2011"),
        ("2016", "Gravity Falls", "", "2012"),
        ("2014", "Adventure Time", "", "2010"),
        ("2013", "Robot Chicken", "", "2005"),
        ("2009", "Avatar: The Last Airbender", "", "2005"),
        ("2007", "Moral Orel", "", "2005"),
        ("2005", "SpongeBob SquarePants", "", "1999"),
        ("2003", "Samurai Jack", "", "2001"),
        ("1998", "The Simpsons", "", "1989"),
        ("1995", "Gargoyles", "", "1994"),
        ("1993", "Batman: The Animated Series", "", "1992"),
    ],
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

def format_tv_record(best, fallback_title="", fallback_orig="", fallback_year=""):
    poster_path = best.get("poster_path")
    backdrop_path = best.get("backdrop_path")
    vote_avg = round(best.get("vote_average", 0), 2)
    vote_count = best.get("vote_count", 0)
    rel_date = best.get("first_air_date") or best.get("release_date") or ""
    rel_year = rel_date[:4] if len(rel_date) >= 4 else str(fallback_year or "")
    orig_lang = (best.get("original_language") or "").lower().strip()

    return {
        "id": best["id"],
        "tmdbId": best["id"],
        "mediaType": "tv",
        "title": best.get("name") or best.get("title") or fallback_title,
        "originalTitle": best.get("original_name") or best.get("original_title") or fallback_orig or fallback_title,
        "year": rel_year,
        "originalLanguage": orig_lang,
        "originalLanguageCode": orig_lang,
        "posterUrl": f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None,
        "backdropUrl": f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else None,
        "rating": f"{round(vote_avg, 1)}/10" if vote_avg > 0 else "NR",
        "ratingValue": vote_avg,
        "voteCount": vote_count,
        "overview": best.get("overview", ""),
        "releaseDate": rel_date,
    }

def search_tmdb_tv(query, year=None):
    if not query:
        return []
    clean_q = urllib.parse.quote(query.strip())
    url = f"https://api.themoviedb.org/3/search/tv?api_key={TMDB_API_KEY}&query={clean_q}"
    if year:
        url += f"&first_air_date_year={year}"
    req = urllib.request.Request(url, headers={"User-Agent": "Trova/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("results", [])
    except Exception:
        return []

def fetch_tmdb_tv_by_id(tmdb_id):
    url = f"https://api.themoviedb.org/3/tv/{tmdb_id}?api_key={TMDB_API_KEY}"
    req = urllib.request.Request(url, headers={"User-Agent": "Trova/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
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
            # Sometimes a miniseries season/episode IMDb ID is returned under tv_episode_results or tv_season_results
            for ep in data.get("tv_episode_results", []):
                show_id = ep.get("show_id")
                if show_id:
                    return fetch_tmdb_tv_by_id(show_id)
    except Exception:
        pass
    return None

def resolve_tmdb_tv_item(title, orig_title, air_year_hint, cache):
    cache_key = f"tv::{title.lower().strip()}::{orig_title.lower().strip()}::{air_year_hint}"
    if cache_key in cache and cache[cache_key] is not None:
        return cache[cache_key]

    year_int = None
    try:
        year_int = int(air_year_hint) if air_year_hint else None
    except ValueError:
        pass

    candidates = []
    if year_int:
        candidates = search_tmdb_tv(title, year_int)
        if not candidates:
            candidates = search_tmdb_tv(title, year_int - 1)
        if not candidates:
            candidates = search_tmdb_tv(title, year_int + 1)

    if not candidates and orig_title:
        if year_int:
            candidates = search_tmdb_tv(orig_title, year_int)
        if not candidates:
            candidates = search_tmdb_tv(orig_title)

    if not candidates:
        candidates = search_tmdb_tv(title)

    if not candidates:
        cache[cache_key] = None
        return None

    norm_title = normalize_title(title)
    norm_orig = normalize_title(orig_title) if orig_title else ""

    best = None
    best_score = -1

    for c in candidates[:8]:
        score = 0
        c_title = c.get("name", "")
        c_orig = c.get("original_name", "")
        c_norm_title = normalize_title(c_title)
        c_norm_orig = normalize_title(c_orig)

        if c_norm_title == norm_title or (norm_orig and c_norm_orig == norm_orig):
            score += 55
        elif norm_title and (norm_title in c_norm_title or c_norm_title in norm_title):
            score += 28
        elif norm_orig and (norm_orig in c_norm_orig or c_norm_orig in norm_orig):
            score += 28

        rel_date = c.get("first_air_date", "")
        if rel_date and year_int:
            try:
                c_year = int(rel_date[:4])
                diff = abs(c_year - year_int)
                if diff == 0:
                    score += 40
                elif diff == 1:
                    score += 30
                elif diff <= 3:
                    score += 15
                elif diff > 10:
                    score -= 20
            except ValueError:
                pass

        if c.get("poster_path"):
            score += 15
        pop = c.get("popularity", 0)
        score += min(15, pop / 8)

        if score > best_score:
            best_score = score
            best = c

    if not best or best_score < 20:
        cache[cache_key] = None
        return None

    result = format_tv_record(best, title, orig_title, air_year_hint)
    cache[cache_key] = result
    return result

def query_wikidata_tv_winners(award_qid):
    """
    Queries Wikidata SPARQL for TV series winning `award_qid`, handling:
    1. Direct P166 on the series
    2. P166 on a season/episode rolled up to the parent series via wdt:P179
    3. P1346 winner on the award or ceremony edition
    Returns bindings with seriesLabel, date, tmdbId (P4983), and imdbId (P345).
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
    LIMIT 35
    """
    url = f"https://query.wikidata.org/sparql?query={urllib.parse.quote(sparql)}&format=json"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": WIKIDATA_USER_AGENT,
            "Accept": "application/sparql-results+json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=18) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("results", {}).get("bindings", [])
    except Exception as e:
        print(f"  [Wikidata note] {award_qid}: {e}")
        return []

def main():
    print("Building Trova Global Television Honors Catalog (40 Ceremonies)...")
    cache = load_cache()
    print(f"Loaded {len(cache)} cached TMDb TV items.")

    # Resolve all historical TV entries in parallel first
    unique_queries = set()
    for c_key, items in HISTORICAL_TV_WINNERS.items():
        for yr, title, orig, air_yr in items:
            unique_queries.add((title, orig, air_yr))

    print(f"Resolving {len(unique_queries)} unique historical TV series against TMDb...")
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [
            executor.submit(resolve_tmdb_tv_item, title, orig, air_yr, cache)
            for (title, orig, air_yr) in unique_queries
        ]
        for future in as_completed(futures):
            future.result()

    save_cache(cache)

    ceremonies_output = []
    all_winners_map = {}

    for c_key, meta in TV_CEREMONY_METADATA.items():
        winners_raw = HISTORICAL_TV_WINNERS.get(c_key, [])
        winners_list = []
        seen_series_year = set()
        seen_series_ids = set()

        for yr, title, orig, air_yr in winners_raw:
            tmdb_item = resolve_tmdb_tv_item(title, orig, air_yr, cache)
            if not tmdb_item or not tmdb_item.get("posterUrl"):
                continue

            tv_id = tmdb_item["id"]
            dedupe_key = f"{tv_id}:{yr}"
            if dedupe_key in seen_series_year:
                continue
            seen_series_year.add(dedupe_key)
            seen_series_ids.add(tv_id)

            winner_record = {
                **tmdb_item,
                "awardYear": yr,
                "award": meta["awardName"],
                "position": 1,
                "ceremonyId": c_key,
                "ceremonyName": meta["name"],
            }
            winners_list.append(winner_record)

            if tv_id not in all_winners_map:
                all_winners_map[tv_id] = {
                    **tmdb_item,
                    "awards": [],
                }
            all_winners_map[tv_id]["awards"].append({
                "ceremonyId": c_key,
                "ceremonyName": meta["name"],
                "award": meta["awardName"],
                "year": yr,
                "position": 1,
            })

        # Supplement with live Wikidata SPARQL query for any newly recorded winners
        qid = meta.get("wikidataId")
        if qid:
            wd_bindings = query_wikidata_tv_winners(qid)
            for b in wd_bindings:
                tmdb_id_str = b.get("tmdbId", {}).get("value", "")
                imdb_id_str = b.get("imdbId", {}).get("value", "")
                label_str = b.get("seriesLabel", {}).get("value", "")
                date_str = b.get("date", {}).get("value", "")
                award_yr = date_str[:4] if len(date_str) >= 4 else ""

                wd_key = f"wd::{tmdb_id_str}::{imdb_id_str}::{label_str}"
                tmdb_item = cache.get(wd_key)
                if tmdb_item is None and wd_key not in cache:
                    raw_tv = None
                    if tmdb_id_str and tmdb_id_str.isdigit():
                        raw_tv = fetch_tmdb_tv_by_id(int(tmdb_id_str))
                    if not raw_tv and imdb_id_str and imdb_id_str.startswith("tt"):
                        raw_tv = find_tmdb_tv_by_imdb(imdb_id_str)
                    if raw_tv and raw_tv.get("id"):
                        tmdb_item = format_tv_record(raw_tv, label_str, "", award_yr)
                    cache[wd_key] = tmdb_item

                if not tmdb_item or not tmdb_item.get("posterUrl"):
                    continue

                tv_id = tmdb_item["id"]
                if tv_id in seen_series_ids:
                    continue

                yr_to_use = award_yr or tmdb_item.get("year") or "2024"
                seen_series_ids.add(tv_id)
                seen_series_year.add(f"{tv_id}:{yr_to_use}")

                winner_record = {
                    **tmdb_item,
                    "awardYear": yr_to_use,
                    "award": meta["awardName"],
                    "position": 1,
                    "ceremonyId": c_key,
                    "ceremonyName": meta["name"],
                }
                winners_list.append(winner_record)

                if tv_id not in all_winners_map:
                    all_winners_map[tv_id] = {
                        **tmdb_item,
                        "awards": [],
                    }
                all_winners_map[tv_id]["awards"].append({
                    "ceremonyId": c_key,
                    "ceremonyName": meta["name"],
                    "award": meta["awardName"],
                    "year": yr_to_use,
                    "position": 1,
                })

        winners_list.sort(key=lambda x: (str(x.get("awardYear", "")), x.get("ratingValue", 0)), reverse=True)
        ceremonies_output.append({
            **meta,
            "winnersCount": len(winners_list),
            "winners": winners_list,
        })
        print(f"  [{len(ceremonies_output):02d}/40] {meta['shortName']}: {len(winners_list)} winning series")

    save_cache(cache)

    all_winners_list = list(all_winners_map.values())
    all_winners_list.sort(key=lambda x: (len(x.get("awards", [])), x.get("ratingValue", 0)), reverse=True)

    catalog_data = {
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "mediaType": "tv",
        "totalCeremonies": len(ceremonies_output),
        "totalUniqueWinners": len(all_winners_list),
        "ceremonies": ceremonies_output,
        "allWinners": all_winners_list,
    }

    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    with open(OUTPUT_JS, "w", encoding="utf-8") as f:
        f.write(
            "export const tvAwardsData = "
            + json.dumps(catalog_data, indent=2, ensure_ascii=False)
            + ";\nexport default tvAwardsData;\n"
        )

    print("\n==========================================")
    print(f"Generated {OUTPUT_JSON} and {OUTPUT_JS}")
    print(f"Total TV ceremonies: {len(ceremonies_output)}")
    print(f"Total unique winning TV series: {len(all_winners_list)}")
    print("==========================================")

if __name__ == "__main__":
    main()
