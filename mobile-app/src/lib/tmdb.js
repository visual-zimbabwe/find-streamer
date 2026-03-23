const TMDB_BASE = 'https://api.themoviedb.org/3';
const HARDCODED_BEARER_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZWNkNDE1YWJhY2VmMzYxM2I5NDc1MWQ5OWRhODU2YSIsIm5iZiI6MTc3MTgwMDUzOS45ODU5OTk4LCJzdWIiOiI2OTliODdkYmYwMTE1NmYxNDljNWE1MTgiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.oXCB5rLBXE6TwtgHGup4lEEX-dI0uTXGUVP8PQesics';

export const SERVICE_LABELS = {
  netflix: 'Netflix',
  amazon_prime_video: 'Prime Video',
  max: 'Max',
};

function normalize(text) {
  return (text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
}

function serviceKey(providerName) {
  const name = normalize(providerName);
  if (name.includes('netflix')) return 'netflix';
  if (name.includes('amazon prime video')) return 'amazon_prime_video';
  if (name === 'max' || name.includes('hbo max')) return 'max';
  return null;
}

async function tmdbGet(pathname, params = {}) {
  const url = new URL(`${TMDB_BASE}${pathname}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${HARDCODED_BEARER_TOKEN}`,
    },
  });

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

  const candidates = (data.results || []).filter((item) => item.media_type === 'movie' || item.media_type === 'tv');
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

  const videos = data.videos?.results || [];
  const youtubeVideos = videos.filter((video) => video.site === 'YouTube' && video.key);
  let trailer = youtubeVideos.find((video) => video.type === 'Trailer' && video.official === true);
  if (!trailer) trailer = youtubeVideos.find((video) => video.type === 'Trailer');
  if (!trailer && youtubeVideos.length) trailer = youtubeVideos[0];

  return {
    year,
    genres: genres.length ? genres.join(', ') : 'N/A',
    rating,
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : 'N/A',
  };
}


async function getCredits(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/credits`);

  const director = (data.crew || []).find((person) => person.job === 'Director' || person.department === 'Directing');
  const starring = (data.cast || []).sort((a, b) => (a.order || 9999) - (b.order || 9999)).slice(0, 4);

  return {
    director: director ? director.name : 'N/A',
    starring: starring.map((person) => person.name).join(', ') || 'N/A',
  };
}


async function getSimilar(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/similar`);
  return (data.results || [])
    .slice(0, 4)
    .map((item) => {
      const dateValue = item.release_date || item.first_air_date || '';
      return {
        mediaType: item.media_type,
        tmdbId: item.id,
        title: item.title || item.name || '(Untitled)',
        year: dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        rating: typeof item.vote_average === 'number' ? `${item.vote_average.toFixed(1)}/10` : 'N/A',
      };
    });
}

async function getProviderCountries(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/watch/providers`);
  const results = data.results || {};

  const availability = { netflix: [], amazon_prime_video: [], max: [] };

  Object.entries(results).forEach(([countryCode, info]) => {
    const providers = [];
    ['flatrate', 'ads', 'free'].forEach((section) => {
      providers.push(...(info[section] || []));
    });

    const seen = new Set();
    providers.forEach((provider) => {
      const key = serviceKey(provider.provider_name || '');
      if (key && !seen.has(key)) {
        availability[key].push(countryCode);
        seen.add(key);
      }
    });
  });

  Object.keys(availability).forEach((key) => availability[key].sort());
  return availability;
}

async function getCountryNames() {
  const data = await tmdbGet('/configuration/countries', { language: 'en-US' });
  const countryNames = {};
  data.forEach((item) => {
    if (item.iso_3166_1) {
      countryNames[item.iso_3166_1] = item.english_name || item.name || item.iso_3166_1;
    }
  });
  return countryNames;
}

function toRows(availability, countryNames) {
  const allCodes = Array.from(new Set(Object.values(availability).flat())).sort();
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

function buildProviderSummary(rows) {
  return Object.entries(SERVICE_LABELS).map(([key, label]) => ({
    key,
    label,
    count: rows.filter((row) => row.providers[key]).length,
  }));
}

export async function resolveMatch(query, match) {
  const [metadata, credits, similar, availability, countryNames] = await Promise.all([
    getTitleMetadata(match.mediaType, match.tmdbId),
    getCredits(match.mediaType, match.tmdbId),
    getSimilar(match.mediaType, match.tmdbId),
    getProviderCountries(match.mediaType, match.tmdbId),
    getCountryNames(),
  ]);

  const rows = toRows(availability, countryNames);

  return {
    query,
    ...match,
    ...metadata,
    ...credits,
    similar,
    rows,
    providerSummary: buildProviderSummary(rows),
  };
}
