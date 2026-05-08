const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const HARDCODED_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZWNkNDE1YWJhY2VmMzYxM2I5NDc1MWQ5OWRhODU2YSIsIm5iZiI6MTc3MTgwMDUzOS45ODU5OTk4LCJzdWIiOiI2OTliODdkYmYwMTE1NmYxNDljNWE1MTgiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.oXCB5rLBXE6TwtgHGup4lEEX-dI0uTXGUVP8PQesics';

const TARGET_SERVICES = {
  netflix: 'Netflix',
  amazon_prime_video: 'Amazon Prime Video',
  max: 'Max'
};
const DIRECT_SERVICE_NAMES = {
  netflix: new Set(['netflix', 'netflix standard with ads', 'netflix basic with ads']),
  amazon_prime_video: new Set(['amazon prime video']),
  max: new Set(['max', 'hbo max'])
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
  return new Set(
    (info.flatrate || [])
      .map((provider) => serviceKey(provider.provider_name || ''))
      .filter(Boolean)
  );
}

function availabilityFromResults(results = {}) {
  const availability = {
    netflix: [],
    amazon_prime_video: [],
    max: []
  };

  for (const [countryCode, info] of Object.entries(results)) {
    for (const key of directFlatrateServices(info)) {
      availability[key].push(countryCode);
    }
  }

  for (const key of Object.keys(availability)) {
    availability[key] = [...new Set(availability[key])].sort();
  }

  return availability;
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

function authHeaders() {
  const envToken = process.env.TMDB_BEARER_TOKEN;
  const token = envToken || HARDCODED_BEARER_TOKEN;
  if (!token) throw new Error('Missing TMDB credentials.');
  return {
    accept: 'application/json',
    Authorization: `Bearer ${token}`
  };
}

async function tmdbGet(pathname, params = {}) {
  const url = new URL(`${TMDB_BASE}${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`TMDB request failed (${response.status}): ${detail}`);
  }
  return response.json();
}

async function searchTitleCandidates(query) {
  const data = await tmdbGet('/search/multi', {
    query,
    include_adult: false,
    language: 'en-US',
    page: 1
  });

  const candidates = (data.results || []).filter((item) => item.media_type === 'movie' || item.media_type === 'tv');
  if (!candidates.length) {
    throw new Error(`No movie or TV results found for: ${query}`);
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
      year: dateValue && dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A',
      synopsis: (item.overview || '').trim() || 'No synopsis available.'
    };
  });
}

async function getTitleMetadata(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}`, {
    language: 'en-US',
    append_to_response: 'videos'
  });

  const dateValue = data.release_date || data.first_air_date || '';
  const year = dateValue && dateValue.length >= 4 ? dateValue.slice(0, 4) : 'N/A';

  const genres = (data.genres || []).map((g) => g.name).filter(Boolean).sort();
  const rating = typeof data.vote_average === 'number' ? `${data.vote_average.toFixed(1)}/10` : 'N/A';
  const runtimeMinutes = mediaType === 'tv'
    ? (data.episode_run_time || []).find((value) => typeof value === 'number' && value > 0) || null
    : data.runtime || null;
  const seasons = mediaType === 'tv'
    ? (data.seasons || [])
        .filter((season) => season.season_number > 0)
        .map((season) => ({
          name: season.name || `Season ${season.season_number}`,
          episodeCount: season.episode_count || 0,
          year: season.air_date ? season.air_date.slice(0, 4) : 'TBA'
        }))
    : [];

  const videos = (data.videos && data.videos.results) || [];
  const youtube = videos.filter((v) => v.site === 'YouTube' && v.key);
  let trailer = youtube.find((v) => v.type === 'Trailer' && v.official === true);
  if (!trailer) trailer = youtube.find((v) => v.type === 'Trailer');
  if (!trailer && youtube.length) trailer = youtube[0];

  return {
    year,
    genres: genres.length ? genres.join(', ') : 'N/A',
    rating,
    runtimeMinutes,
    numberOfSeasons: mediaType === 'tv' ? data.number_of_seasons || seasons.length : null,
    numberOfEpisodes: mediaType === 'tv' ? data.number_of_episodes || seasons.reduce((total, season) => total + season.episodeCount, 0) : null,
    seasons,
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : 'N/A'
  };
}

async function getProviderCountries(mediaType, tmdbId) {
  if (mediaType === 'tv') {
    return getCompleteTvProviderCountries(tmdbId);
  }

  const data = await tmdbGet(`/${mediaType}/${tmdbId}/watch/providers`);
  return availabilityFromResults(data.results || {});
}

async function getCompleteTvProviderCountries(tmdbId) {
  const details = await tmdbGet(`/tv/${tmdbId}`, { language: 'en-US' });
  const episodes = (details.seasons || [])
    .filter((season) => season.season_number > 0)
    .flatMap((season) => Array.from(
      { length: season.episode_count || 0 },
      (_unused, index) => ({ seasonNumber: season.season_number, episodeNumber: index + 1 })
    ));

  if (!episodes.length) {
    const data = await tmdbGet(`/tv/${tmdbId}/watch/providers`);
    return availabilityFromResults(data.results || {});
  }

  const episodeResults = await mapWithConcurrency(episodes, 8, (episode) =>
    tmdbGet(`/tv/${tmdbId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}/watch/providers`)
  );
  const availability = {
    netflix: null,
    amazon_prime_video: null,
    max: null
  };

  for (const data of episodeResults) {
    const episodeAvailability = {
      netflix: new Set(),
      amazon_prime_video: new Set(),
      max: new Set()
    };

    for (const [countryCode, info] of Object.entries(data.results || {})) {
      for (const key of directFlatrateServices(info)) {
        episodeAvailability[key].add(countryCode);
      }
    }

    for (const key of Object.keys(availability)) {
      availability[key] = availability[key] === null
        ? episodeAvailability[key]
        : new Set([...availability[key]].filter((countryCode) => episodeAvailability[key].has(countryCode)));
    }
  }

  return Object.fromEntries(
    Object.entries(availability).map(([key, countryCodes]) => [key, [...(countryCodes || new Set())].sort()])
  );
}

async function getCountryNames() {
  const data = await tmdbGet('/configuration/countries', { language: 'en-US' });
  const map = {};
  for (const item of data) {
    if (item.iso_3166_1) {
      map[item.iso_3166_1] = item.english_name || item.name || item.iso_3166_1;
    }
  }
  return map;
}

function buildRows(availability, countryNames) {
  const serviceCountrySets = {
    netflix: new Set(availability.netflix || []),
    amazon_prime_video: new Set(availability.amazon_prime_video || []),
    max: new Set(availability.max || [])
  };

  const allCodes = [...new Set(Object.values(availability).flat())].sort();

  const rows = allCodes.map((code) => ({
    country: countryNames[code] || code,
    code,
    netflix: serviceCountrySets.netflix.has(code),
    amazonPrimeVideo: serviceCountrySets.amazon_prime_video.has(code),
    max: serviceCountrySets.max.has(code)
  }));

  rows.sort((a, b) => a.country.localeCompare(b.country) || a.code.localeCompare(b.code));
  return rows;
}

async function resolveMatch(query, match) {
  if (!match || (match.mediaType !== 'movie' && match.mediaType !== 'tv') || !match.tmdbId) {
    throw new Error('Invalid title selection.');
  }

  const [metadata, availability, countryNames] = await Promise.all([
    getTitleMetadata(match.mediaType, match.tmdbId),
    getProviderCountries(match.mediaType, match.tmdbId),
    getCountryNames()
  ]);

  return {
    query,
    matched: match.title,
    mediaType: match.mediaType,
    synopsis: match.synopsis,
    year: metadata.year,
    genres: metadata.genres,
    rating: metadata.rating,
    runtimeMinutes: metadata.runtimeMinutes,
    numberOfSeasons: metadata.numberOfSeasons,
    numberOfEpisodes: metadata.numberOfEpisodes,
    seasons: metadata.seasons,
    trailer: metadata.trailer,
    serviceLabels: TARGET_SERVICES,
    rows: buildRows(availability, countryNames)
  };
}

ipcMain.handle('search-title', async (_event, query) => {
  const q = String(query || '').trim();
  if (!q) throw new Error('Please enter a movie or TV show title.');

  const matches = await searchTitleCandidates(q);
  return { query: q, matches };
});

ipcMain.handle('select-title', async (_event, payload) => {
  const query = String(payload?.query || '').trim();
  if (!query) throw new Error('Please enter a movie or TV show title.');
  return resolveMatch(query, payload?.match);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: '#0f1726',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
