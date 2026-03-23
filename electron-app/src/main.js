const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const HARDCODED_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZWNkNDE1YWJhY2VmMzYxM2I5NDc1MWQ5OWRhODU2YSIsIm5iZiI6MTc3MTgwMDUzOS45ODU5OTk4LCJzdWIiOiI2OTliODdkYmYwMTE1NmYxNDljNWE1MTgiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.oXCB5rLBXE6TwtgHGup4lEEX-dI0uTXGUVP8PQesics';

const TARGET_SERVICES = {
  netflix: 'Netflix',
  amazon_prime_video: 'Amazon Prime Video',
  max: 'Max'
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

  const videos = (data.videos && data.videos.results) || [];
  const youtube = videos.filter((v) => v.site === 'YouTube' && v.key);
  let trailer = youtube.find((v) => v.type === 'Trailer' && v.official === true);
  if (!trailer) trailer = youtube.find((v) => v.type === 'Trailer');
  if (!trailer && youtube.length) trailer = youtube[0];

  return {
    year,
    genres: genres.length ? genres.join(', ') : 'N/A',
    rating,
    trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : 'N/A'
  };
}

async function getProviderCountries(mediaType, tmdbId) {
  const data = await tmdbGet(`/${mediaType}/${tmdbId}/watch/providers`);
  const results = data.results || {};

  const availability = {
    netflix: [],
    amazon_prime_video: [],
    max: []
  };

  for (const [countryCode, info] of Object.entries(results)) {
    const providers = [];
    for (const section of ['flatrate', 'ads', 'free']) {
      providers.push(...(info[section] || []));
    }

    const seen = new Set();
    for (const provider of providers) {
      const key = serviceKey(provider.provider_name || '');
      if (key && !seen.has(key)) {
        availability[key].push(countryCode);
        seen.add(key);
      }
    }
  }

  for (const key of Object.keys(availability)) {
    availability[key].sort();
  }

  return availability;
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
