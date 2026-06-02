import { buildDefaultPrepopulatedMovieWatchlist } from './defaultMovieWatchlist.js';
import { buildDefaultPrepopulatedTvWatchlist } from './defaultWatchlist.js';
import { watchlistEntryKey } from './watchlistModel.js';

let moviesCache = null;
let tvCache = null;
let lookupCache = null;

function buildLookup(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = watchlistEntryKey(item);
    if (key) map.set(key, item);
  });
  return map;
}

function ensureLookup() {
  if (!lookupCache) {
    lookupCache = buildLookup([...getImdbTop100Movies(), ...getImdbTop100Tv()]);
  }
  return lookupCache;
}

export function getImdbTop100Movies() {
  if (!moviesCache) moviesCache = buildDefaultPrepopulatedMovieWatchlist();
  return moviesCache;
}

export function getImdbTop100Tv() {
  if (!tvCache) tvCache = buildDefaultPrepopulatedTvWatchlist();
  return tvCache;
}

export function getImdbTop100Item(mediaType, tmdbId) {
  if (!mediaType || tmdbId == null) return null;
  return ensureLookup().get(`${mediaType}:${tmdbId}`) || null;
}
