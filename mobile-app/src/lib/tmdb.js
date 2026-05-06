const TMDB_BASE = 'https://api.themoviedb.org/3';
const HARDCODED_BEARER_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZWNkNDE1YWJhY2VmMzYxM2I5NDc1MWQ5OWRhODU2YSIsIm5iZiI6MTc3MTgwMDUzOS45ODU5OTk4LCJzdWIiOiI2OTliODdkYmYwMTE1NmYxNDljNWE1MTgiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.oXCB5rLBXE6TwtgHGup4lEEX-dI0uTXGUVP8PQesics';
const TMDB_REQUEST_TIMEOUT_MS = 12000;
const TV_EPISODE_PROVIDER_LOOKUP_ENABLED = process.env.EXPO_PUBLIC_TMDB_TV_EPISODE_LOOKUP === 'true';
const TV_EPISODE_PROVIDER_MAX_EPISODES = Number(process.env.EXPO_PUBLIC_TMDB_TV_EPISODE_MAX_EPISODES || 60);

export const SERVICE_LABELS = {
  netflix: 'Netflix',
  amazon_prime_video: 'Prime Video',
  max: 'Max',
};
const DIRECT_SERVICE_NAMES = {
  netflix: new Set(['netflix', 'netflix standard with ads', 'netflix basic with ads']),
  amazon_prime_video: new Set(['amazon prime video']),
  max: new Set(['max', 'hbo max']),
};

function normalize(text) {
  return (text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
}

function serviceKey(providerName) {
  const name = normalize(providerName);
  for (const [key, directNames] of Object.entries(DIRECT_SERVICE_NAMES)) {
    if (directNames.has(name)) return key;
  }
  return null;
}

function directFlatrateServices(info = {}) {
  const matched = new Map();
  (info.flatrate || []).forEach((provider) => {
    const key = serviceKey(provider.provider_name || '');
    if (key && !matched.has(key)) {
      matched.set(key, provider.logo_path || null);
    }
  });
  return matched;
}

function availabilityFromResults(results = {}) {
  const availability = { netflix: [], amazon_prime_video: [], max: [] };
  const logos = { netflix: null, amazon_prime_video: null, max: null };

  Object.entries(results).forEach(([countryCode, info]) => {
    directFlatrateServices(info).forEach((logoPath, key) => {
      availability[key].push(countryCode);
      if (!logos[key] && logoPath) logos[key] = logoPath;
    });
  });

  Object.keys(availability).forEach((key) => {
    availability[key] = Array.from(new Set(availability[key])).sort();
  });

  return { ...availability, logos };
}

async function mapWithConcurrency(items, limit, task) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function createTimeoutSignal(timeoutMs) {
  if (typeof AbortController === 'undefined') return {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

async function tmdbGet(pathname, params = {}) {
  const url = new URL(`${TMDB_BASE}${pathname}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  const timeout = createTimeoutSignal(TMDB_REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${HARDCODED_BEARER_TOKEN}`,
      },
      signal: timeout.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Network request timed out. Check your connection and try again.');
    }
    throw new Error('Network request failed. Check your connection and try again.');
  } finally {
    timeout.clear?.();
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`TMDB request failed (${response.status}): ${message}`);
  }

  return response.json();
}

export async function searchTitleCandidates(query) {
  const data = await tmdbGet('/search/multi', {
    query,
    include_adult: false,
    language: 'en-US',
    page: 1,
  });

  const allResults = data.results || [];

  // If the top result is a person, treat the whole search as a person query.
  // A person result is considered "strong" when it is ranked #1 by TMDB and has
  // a known_for_department (i.e. it is a real person profile, not a stub).
  const topResult = allResults[0];
  if (topResult?.media_type === 'person' && topResult.known_for_department) {
    return {
      isPerson: true,
      personId: topResult.id,
      personName: topResult.name || query,
      role: 'cast',
    };
  }

  const candidates = allResults.filter((item) => item.media_type === 'movie' || item.media_type === 'tv');
  if (!candidates.length) {
    const error = new Error(`No movie or TV results found for: ${query}`);
    error.code = 'NO_RESULTS';
    throw error;
  }

  const queryNorm = normalize(query);
  candidates.sort((a, b) => {
    const aTitle = normalize(a.title || a.name || '');
    const bTitle = normalize(b.title || b.name || '');
    const aExact = aTitle === queryNorm ? 0 : 1;
    const bExact = bTitle === queryNorm ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return (b.popularity || 0) - (a.popularity || 0);
  });

  return candidates.slice(0, 10).map((item) => {
    const dateValue = item.release_date || item.first_air_date || '';
    return {
      mediaType: item.media_type,
      tmdbId: item.id,
      title: item.title || item.name || '(Untitled)',
      year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
      synopsis: (item.overview || '').trim() || 'No synopsis available.',
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
    };
  });
}

async function getTitleMetadata(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}`, {
    language: 'en-US',
    append_to_response: 'videos',
  });

  const dateValue = data.release_date || data.first_air_date || '';
  const year = dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A';
  const genres = (data.genres || []).map((genre) => genre.name).filter(Boolean).sort();
  const rating = typeof data.vote_average === 'number' ? `${data.vote_average.toFixed(1)}/10` : 'N/A';
  const runtimeMinutes = mediaType === 'tv'
    ? (data.episode_run_time || []).find((value) => typeof value === 'number' && value > 0) || null
    : data.runtime || null;
  const seasons = mediaType === 'tv'
    ? (data.seasons || [])
        .filter((season) => season.season_number > 0)
        .map((season) => ({
          id: season.id,
          name: season.name || `Season ${season.season_number}`,
          seasonNumber: season.season_number,
          episodeCount: season.episode_count || 0,
          year: season.air_date ? season.air_date.slice(0, 4) : 'TBA',
          posterUrl: season.poster_path ? `https://image.tmdb.org/t/p/w300${season.poster_path}` : null,
        }))
    : [];

  const videos = data.videos?.results || [];
  const youtubeVideos = videos.filter((video) => video.site === 'YouTube' && video.key);
  let trailer = youtubeVideos.find((video) => video.type === 'Trailer' && video.official === true);
  if (!trailer) trailer = youtubeVideos.find((video) => video.type === 'Trailer');
  if (!trailer && youtubeVideos.length) trailer = youtubeVideos[0];

  return {
    year,
    genres: genres.length ? genres.join(', ') : 'N/A',
    rating,
    runtimeMinutes,
    numberOfSeasons: mediaType === 'tv' ? data.number_of_seasons || seasons.length : null,
    numberOfEpisodes: mediaType === 'tv' ? data.number_of_episodes || seasons.reduce((total, season) => total + season.episodeCount, 0) : null,
    createdBy: mediaType === 'tv'
      ? (data.created_by || []).map((person) => person.name).filter(Boolean).join(', ') || 'N/A'
      : null,
    createdByPersons: mediaType === 'tv'
      ? (data.created_by || []).filter((p) => p.id && p.name).map((p) => ({ id: p.id, name: p.name }))
      : [],
    seasons,
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : 'N/A',
  };
}


async function getCredits(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/credits`);

  const crew = data.crew || [];
  const director = crew.find((person) => person.job === 'Director')
    ?? crew.find((person) => person.department === 'Directing');
  const topCast = (data.cast || []).sort((a, b) => (a.order || 9999) - (b.order || 9999)).slice(0, 5);

  return {
    director: director ? director.name : 'N/A',
    directorId: director ? director.id : null,
    starring: topCast.map((person) => person.name).join(', ') || 'N/A',
    starringPersons: topCast
      .filter((p) => p.id && p.name)
      .map((p) => ({ id: p.id, name: p.name })),
  };
}


async function getSimilar(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/similar`);
  const results = (data.results || []).map((item) => {
    const dateValue = item.release_date || item.first_air_date || '';
    return {
      mediaType: item.media_type || mediaType,
      tmdbId: item.id,
      title: item.title || item.name || '(Untitled)',
      year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      ratingValue: item.vote_average || 0,
      rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
    };
  });

  // Sort by rating desc and take top 5
  return results
    .sort((a, b) => b.ratingValue - a.ratingValue)
    .slice(0, 5);
}

async function getProviderCountries(mediaType, tmdbId) {
  const cacheKey = `${mediaType}:${tmdbId}`;
  if (_providerCountryCache.has(cacheKey)) return _providerCountryCache.get(cacheKey);

  let availability;
  if (mediaType === 'tv') {
    availability = await getTvProviderCountries(tmdbId);
  } else {
    const data = await tmdbGet(`/${mediaType}/${tmdbId}/watch/providers`);
    availability = availabilityFromResults(data.results || {});
  }

  _providerCountryCache.set(cacheKey, availability);
  return availability;
}

const _providerCountryCache = new Map();
let _countryNamesCache = null;

async function getTvProviderCountries(tmdbId) {
  const showLevelData = await tmdbGet(`/tv/${tmdbId}/watch/providers`);
  const showLevelAvailability = availabilityFromResults(showLevelData.results || {});
  showLevelAvailability.confidence = 'show';

  if (!TV_EPISODE_PROVIDER_LOOKUP_ENABLED) {
    return showLevelAvailability;
  }

  return getCompleteTvProviderCountries(tmdbId, showLevelAvailability);
}

async function getCompleteTvProviderCountries(tmdbId, fallbackAvailability = null) {
  const details = await tmdbGet(`/tv/${tmdbId}`, { language: 'en-US' });
  const episodes = (details.seasons || [])
    .filter((season) => season.season_number > 0)
    .flatMap((season) => Array.from(
      { length: season.episode_count || 0 },
      (_unused, index) => ({ seasonNumber: season.season_number, episodeNumber: index + 1 })
    ));

  if (!episodes.length) {
    return fallbackAvailability || { netflix: [], amazon_prime_video: [], max: [], confidence: 'show' };
  }

  if (episodes.length > TV_EPISODE_PROVIDER_MAX_EPISODES) {
    return fallbackAvailability || { netflix: [], amazon_prime_video: [], max: [], confidence: 'show' };
  }

  const episodeResults = await mapWithConcurrency(episodes, 8, (episode) =>
    tmdbGet(`/tv/${tmdbId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}/watch/providers`)
  );
  const availability = { netflix: null, amazon_prime_video: null, max: null };
  const logos = { netflix: null, amazon_prime_video: null, max: null };

  episodeResults.forEach((data) => {
    const episodeAvailability = {
      netflix: new Set(),
      amazon_prime_video: new Set(),
      max: new Set(),
    };

    Object.entries(data.results || {}).forEach(([countryCode, info]) => {
      directFlatrateServices(info).forEach((logoPath, key) => {
        episodeAvailability[key].add(countryCode);
        if (!logos[key] && logoPath) logos[key] = logoPath;
      });
    });

    Object.keys(availability).forEach((key) => {
      if (availability[key] === null) {
        availability[key] = episodeAvailability[key];
      } else {
        availability[key] = new Set([...availability[key]].filter((countryCode) => episodeAvailability[key].has(countryCode)));
      }
    });
  });

  return {
    ...Object.fromEntries(
      Object.entries(availability).map(([key, countryCodes]) => [key, Array.from(countryCodes || []).sort()])
    ),
    logos,
    confidence: 'episode',
  };
}

async function getCountryNames() {
  if (_countryNamesCache) return _countryNamesCache;
  const data = await tmdbGet('/configuration/countries', { language: 'en-US' });
  const countryNames = {};
  data.forEach((item) => {
    if (item.iso_3166_1) {
      countryNames[item.iso_3166_1] = item.english_name || item.name || item.iso_3166_1;
    }
  });
  _countryNamesCache = countryNames;
  return countryNames;
}

function toRows(availability, countryNames) {
  const allCodes = Array.from(
    new Set(Object.keys(SERVICE_LABELS).flatMap((key) => availability[key] || []))
  ).sort();
  const netflix = new Set(availability.netflix || []);
  const prime = new Set(availability.amazon_prime_video || []);
  const max = new Set(availability.max || []);

  const rows = allCodes.map((code) => ({
    country: countryNames[code] || code,
    code,
    providers: {
      netflix: netflix.has(code),
      amazon_prime_video: prime.has(code),
      max: max.has(code),
    },
  }));

  rows.sort((a, b) => a.country.localeCompare(b.country) || a.code.localeCompare(b.code));
  return rows;
}

const SERVICE_FALLBACK_COLORS = {
  netflix: '#E50914',
  amazon_prime_video: '#00A8E1',
  max: '#002BE7',
};

function buildProviderSummary(rows, logos = {}) {
  return Object.entries(SERVICE_LABELS).map(([key, label]) => ({
    key,
    label,
    count: rows.filter((row) => row.providers[key]).length,
    logoUrl: logos[key] ? `https://image.tmdb.org/t/p/original${logos[key]}` : null,
    fallbackColor: SERVICE_FALLBACK_COLORS[key],
  }));
}

// ─── Discover / Filter API ──────────────────────────────────────────────────

// In-memory genre cache: { movie: [...], tv: [...] }
const _genreCache = {};

export async function fetchGenres(mediaType) {
  if (_genreCache[mediaType]) return _genreCache[mediaType];

  const endpoint = mediaType === 'tv' ? '/genre/tv/list' : '/genre/movie/list';
  const data = await tmdbGet(endpoint, { language: 'en-US' });
  const genres = (data.genres || []).map((g) => ({ id: g.id, name: g.name }));
  _genreCache[mediaType] = genres;
  return genres;
}

// In-memory language/country cache
let _languageCache = null;
let _countryDiscoverCache = null;

export async function fetchLanguages() {
  if (_languageCache) return _languageCache;
  const data = await tmdbGet('/configuration/languages');
  const sorted = (Array.isArray(data) ? data : [])
    .filter((l) => l.english_name && l.english_name.trim())
    .sort((a, b) => a.english_name.localeCompare(b.english_name))
    .map((l) => ({ code: l.iso_639_1, label: l.english_name }));
  _languageCache = [{ code: null, label: 'Any Language' }, ...sorted];
  return _languageCache;
}

export async function fetchDiscoverCountries() {
  if (_countryDiscoverCache) return _countryDiscoverCache;
  const data = await tmdbGet('/configuration/countries', { language: 'en-US' });
  const sorted = (Array.isArray(data) ? data : [])
    .filter((c) => c.english_name && c.english_name.trim())
    .sort((a, b) => a.english_name.localeCompare(b.english_name))
    .map((c) => ({ code: c.iso_3166_1, label: c.english_name }));
  _countryDiscoverCache = [{ code: null, label: 'Any Country' }, ...sorted];
  return _countryDiscoverCache;
}

// ─── Anime Smart-Filter ─────────────────────────────────────────────────────
// Anime is not an official TMDB genre. We approximate it by flagging items
// that (a) have Japanese as their original language AND carry the Animation
// genre (id 16), OR (b) have 'anime' in their title/overview (rough heuristic).
// TMDB genre id 16 = Animation.
const ANIMATION_GENRE_ID = 16;

function isLikelyAnime(rawItem) {
  const lang = (rawItem.original_language || '').toLowerCase();
  const genreIds = rawItem.genre_ids || [];
  if (lang === 'ja' && genreIds.includes(ANIMATION_GENRE_ID)) return true;

  // Secondary heuristic: title or overview contains 'anime'
  const titleLower = (rawItem.title || rawItem.name || '').toLowerCase();
  const overviewLower = (rawItem.overview || '').toLowerCase();
  if (titleLower.includes('anime') || overviewLower.includes('anime')) return true;

  return false;
}

/**
 * Call /3/discover/movie or /3/discover/tv with a filter object.
 *
 * filters = {
 *   mediaType: 'movie' | 'tv',
 *   genreIds: number[],            // include genres (AND/OR)
 *   genreLogic: 'AND' | 'OR',
 *   excludeGenreIds: number[],     // official TMDB genres to exclude
 *   excludeSmartTags: string[],    // e.g. ['anime']
 *   minRating: number | null,      // vote_average.gte
 *   languageCodes: string[],       // ISO 639-1, e.g. ['en', 'ja']
 *   originCountries: string[],     // ISO 3166-1, TV only, e.g. ['US', 'KR']
 *   fromYear: string | null,       // '2010'
 *   toYear: string | null,         // '2024'
 *   sortBy: string,                // 'popularity.desc' etc.
 *   page: number,
 * }
 *
 * Returns { results, totalResults, totalPages, page }
 */
export async function discoverTitles(filters = {}) {
  const {
    mediaType = 'movie',
    genreIds = [],
    genreLogic = 'AND',
    excludeGenreIds = [],
    excludeSmartTags = [],
    minRating = null,
    languageCodes = [],
    originCountries = [],
    fromYear = null,
    toYear = null,
    sortBy = 'popularity.desc',
    excludeEnglish = false,
    page = 1,
  } = filters;

  const params = {
    sort_by: sortBy,
    'vote_count.gte': 20,
    include_adult: false,
    page,
  };

  // ── Include genres ──────────────────────────────────────────────────────────
  if (genreIds.length > 0) {
    const separator = genreLogic === 'OR' ? '|' : ',';
    params.with_genres = genreIds.join(separator);
  }

  // ── Exclude genres (TMDB native support) ───────────────────────────────────
  if (excludeGenreIds.length > 0) {
    // TMDB: without_genres accepts comma-separated IDs (always AND-exclusion)
    params.without_genres = excludeGenreIds.join(',');
  }

  if (minRating != null && minRating > 0) {
    params['vote_average.gte'] = minRating;
  }

  if (languageCodes.length > 0) {
    params.with_original_language = languageCodes.join('|');
  } else if (excludeEnglish) {
    // TMDB doesn't have a native 'without_original_language'.
    // We simulate it by including all other common languages.
    const allLangs = await fetchLanguages();
    const otherCodes = allLangs
      .map(l => l.code)
      .filter(code => code !== null && code !== 'en');
    params.with_original_language = otherCodes.join('|');
  }

  if (mediaType === 'tv' && originCountries.length > 0) {
    params.with_origin_country = originCountries.join('|');
  }

  if (mediaType === 'movie') {
    if (fromYear) params['primary_release_date.gte'] = `${fromYear}-01-01`;
    if (toYear)   params['primary_release_date.lte'] = `${toYear}-12-31`;
  } else {
    if (fromYear) params['first_air_date.gte'] = `${fromYear}-01-01`;
    if (toYear)   params['first_air_date.lte'] = `${toYear}-12-31`;
  }

  const data = await tmdbGet(`/discover/${mediaType}`, params);

  const excludeAnime = excludeSmartTags.includes('anime');

  const rawItems = data.results || [];
  const filtered = excludeAnime ? rawItems.filter((item) => !isLikelyAnime(item)) : rawItems;

  const results = filtered.map((item) => {
    const dateValue = item.release_date || item.first_air_date || '';
    return {
      mediaType,
      tmdbId: item.id,
      title: item.title || item.name || '(Untitled)',
      year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
      synopsis: (item.overview || '').trim() || 'No synopsis available.',
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
      ratingValue: item.vote_average || 0,
      rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
    };
  });

  // When Anime is excluded we may have removed some items from the page,
  // so adjust the reported count to avoid misleading the user.
  const removedCount = rawItems.length - filtered.length;
  const adjustedTotal = Math.max(0, (data.total_results || 0) - removedCount);

  return {
    results,
    totalResults: adjustedTotal,
    totalPages: data.total_pages || 1,
    page: data.page || 1,
  };
}

// ─── Now Playing ─────────────────────────────────────────────────────────────

/**
 * Fetch movies currently in theatres from TMDB, sorted by rating (highest first).
 * Merges page 1 and page 2 to give a richer result set (~40 titles).
 */
export async function fetchNowPlayingMovies() {
  const [page1, page2] = await Promise.all([
    tmdbGet('/movie/now_playing', { language: 'en-US', page: 1 }),
    tmdbGet('/movie/now_playing', { language: 'en-US', page: 2 }),
  ]);

  const raw = [...(page1.results || []), ...(page2.results || [])];

  // Deduplicate by id
  const seen = new Set();
  const unique = raw.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Sort highest rating first
  unique.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

  return unique.map((item) => {
    const dateValue = item.release_date || '';
    return {
      mediaType: 'movie',
      tmdbId: item.id,
      title: item.title || '(Untitled)',
      year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
      synopsis: (item.overview || '').trim() || 'No synopsis available.',
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
      ratingValue: item.vote_average || 0,
      rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
    };
  });
}

// ─── Resolution ─────────────────────────────────────────────────────────────

export async function resolveMatch(query, match) {
  const [metadata, credits, similar, availability, countryNames] = await Promise.all([
    getTitleMetadata(match.mediaType, match.tmdbId),
    getCredits(match.mediaType, match.tmdbId),
    getSimilar(match.mediaType, match.tmdbId),
    getProviderCountries(match.mediaType, match.tmdbId),
    getCountryNames(),
  ]);

  const rows = toRows(availability, countryNames);
  const serviceLogos = availability.logos || {};

  return {
    query,
    ...match,
    ...metadata,
    ...credits,
    similar,
    rows,
    providerSummary: buildProviderSummary(rows, serviceLogos),
    serviceLogos: Object.fromEntries(
      Object.entries(serviceLogos).map(([key, path]) => [
        key,
        path ? `https://image.tmdb.org/t/p/original${path}` : null,
      ])
    ),
    providerAvailabilityConfidence: availability.confidence || 'show',
  };
}

// ─── Filmography ─────────────────────────────────────────────────────────────

/**
 * Fetch all movies directed by, or TV shows created by, a specific TMDB person.
 * @param {number} personId  TMDB person ID
 * @param {string} personName Display name
 * @param {'movie'|'tv'} mediaType
 */
export async function fetchPersonFilmography(personId, personName, role) {
  // role: 'movie' (director), 'tv' (creator), or 'cast' (actor starring in movies/shows)
  let items;
  let resolvedMediaType; // used to set mediaType on result items

  if (role === 'cast') {
    // Combined credits covers both movies and TV the actor appeared in
    const data = await tmdbGet(`/person/${personId}/combined_credits`, { language: 'en-US' });
    const castCredits = (data.cast || [])
      .filter((c) => c.media_type === 'movie' || c.media_type === 'tv')
      .filter((c) => c.vote_count >= 5); // skip obscure entries

    // Deduplicate by id
    const seen = new Set();
    const unique = castCredits.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    // Sort by rating descending (highest to lowest)
    unique.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

    const results = unique.map((item) => {
      const dateValue = item.release_date || item.first_air_date || '';
      return {
        mediaType: item.media_type,
        tmdbId: item.id,
        title: item.title || item.name || '(Untitled)',
        year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
        synopsis: (item.overview || '').trim() || 'No synopsis available.',
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
        ratingValue: item.vote_average || 0,
        rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
        character: item.character || '',
      };
    });

    // Get profile image
    const personData = await tmdbGet(`/person/${personId}`, { language: 'en-US' });
    const profileUrl = personData.profile_path ? `https://image.tmdb.org/t/p/w185${personData.profile_path}` : null;

    return { personName, role: 'cast', results, profileUrl };
  }

  // Director / Creator path
  const endpoint = role === 'movie'
    ? `/person/${personId}/movie_credits`
    : `/person/${personId}/tv_credits`;

  const data = await tmdbGet(endpoint, { language: 'en-US' });
  resolvedMediaType = role;

  if (role === 'movie') {
    items = (data.crew || []).filter((c) => c.job === 'Director');
  } else {
    items = (data.crew || []).filter((c) => c.job === 'Creator');
    if (!items.length) items = data.crew || [];
  }

  // Deduplicate by id
  const seen = new Set();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Sort by rating descending (highest to lowest)
  unique.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

  const results = unique.map((item) => {
    const dateValue = item.release_date || item.first_air_date || '';
    return {
      mediaType: resolvedMediaType,
      tmdbId: item.id,
      title: item.title || item.name || '(Untitled)',
      year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
      synopsis: (item.overview || '').trim() || 'No synopsis available.',
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
      ratingValue: item.vote_average || 0,
      rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
    };
  });

  // Get profile image
  const personData = await tmdbGet(`/person/${personId}`, { language: 'en-US' });
  const profileUrl = personData.profile_path ? `https://image.tmdb.org/t/p/w185${personData.profile_path}` : null;

  return { personName, role, results, profileUrl };
}
