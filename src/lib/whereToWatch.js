// @ts-check
//
// Where-to-watch filtering for the watchlist: given the user's saved titles,
// answer "which of these can I stream right now in country X (optionally on
// service Y)?". Availability comes from TMDB `watch/providers` lookups (see
// tmdb.js / providerAvailability.js); because a large watchlist means hundreds
// of lookups, results are cached in AsyncStorage with a TTL so repeat filters
// are instant and offline-tolerant.
//
// Everything except the AsyncStorage default is pure / injectable so the logic
// can be exercised by node tests.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVICE_LABELS } from './providerAvailability.js';
import { isInUserLibrary, watchlistEntryKey } from './watchlistModel.js';

/** @typedef {import('./types.js').WatchlistItem} WatchlistItem */

/**
 * @typedef {Object} WhereToWatchFilter
 * @property {string} countryCode           ISO 3166-1 alpha-2, e.g. 'CA'
 * @property {string | null} serviceKey     key of SERVICE_LABELS, or null = any service
 */

/**
 * @typedef {Object.<string, string[]>} ServiceCountryMap
 * Compact availability: service key → country codes. Only services with at
 * least one country are present.
 */

const CACHE_STORAGE_KEY = 'find-streamer/where-to-watch/availability-cache/v1';
const PREFS_STORAGE_KEY = 'find-streamer/where-to-watch/prefs/v1';

// Streaming catalogues shift on a weekly-to-monthly cadence; three days keeps
// results honest without re-fetching an entire library every session.
export const AVAILABILITY_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const AVAILABILITY_CACHE_MAX_ENTRIES = 1500;

export const DEFAULT_WHERE_TO_WATCH_COUNTRY = { code: 'CA', label: 'Canada' };

export const WHERE_TO_WATCH_SERVICES = Object.entries(SERVICE_LABELS).map(([key, label]) => ({
  key,
  label,
}));

export function getServiceLabel(serviceKey) {
  return serviceKey ? SERVICE_LABELS[serviceKey] || serviceKey : 'Any Service';
}

// Used when TMDB's `/watch/providers/regions` endpoint is unreachable. Covers
// the markets of the ten tracked services plus the major streaming markets.
export const FALLBACK_WATCH_REGIONS = [
  { code: 'AR', label: 'Argentina' },
  { code: 'AU', label: 'Australia' },
  { code: 'AT', label: 'Austria' },
  { code: 'BE', label: 'Belgium' },
  { code: 'BR', label: 'Brazil' },
  { code: 'CA', label: 'Canada' },
  { code: 'CL', label: 'Chile' },
  { code: 'CO', label: 'Colombia' },
  { code: 'CZ', label: 'Czech Republic' },
  { code: 'DK', label: 'Denmark' },
  { code: 'FI', label: 'Finland' },
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Germany' },
  { code: 'GR', label: 'Greece' },
  { code: 'HK', label: 'Hong Kong' },
  { code: 'HU', label: 'Hungary' },
  { code: 'IN', label: 'India' },
  { code: 'ID', label: 'Indonesia' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IL', label: 'Israel' },
  { code: 'IT', label: 'Italy' },
  { code: 'JP', label: 'Japan' },
  { code: 'MY', label: 'Malaysia' },
  { code: 'MX', label: 'Mexico' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'NO', label: 'Norway' },
  { code: 'PH', label: 'Philippines' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'SG', label: 'Singapore' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'KR', label: 'South Korea' },
  { code: 'ES', label: 'Spain' },
  { code: 'SE', label: 'Sweden' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'TW', label: 'Taiwan' },
  { code: 'TH', label: 'Thailand' },
  { code: 'TR', label: 'Turkey' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
];

// ─── Pure matching ───────────────────────────────────────────────────────────

/**
 * Strip a full availability object (which carries `logos`, `confidence`, and
 * empty service arrays) down to the compact service → countries map we cache.
 * @param {object} availability
 * @returns {ServiceCountryMap}
 */
export function compactAvailabilityServices(availability) {
  /** @type {ServiceCountryMap} */
  const services = {};
  Object.keys(SERVICE_LABELS).forEach((key) => {
    const countries = availability?.[key];
    if (Array.isArray(countries) && countries.length) {
      services[key] = countries;
    }
  });
  return services;
}

/**
 * Service keys that stream the title in the given country.
 * @param {ServiceCountryMap | null | undefined} services
 * @param {string} countryCode
 * @returns {string[]}
 */
export function matchingServiceKeys(services, countryCode) {
  if (!services || !countryCode) return [];
  return Object.keys(SERVICE_LABELS).filter((key) => services[key]?.includes(countryCode));
}

/**
 * @param {ServiceCountryMap | null | undefined} services
 * @param {WhereToWatchFilter} filter
 * @returns {boolean}
 */
export function titleMatchesWhereToWatch(services, filter) {
  if (!services || !filter?.countryCode) return false;
  if (filter.serviceKey) {
    return services[filter.serviceKey]?.includes(filter.countryCode) || false;
  }
  return matchingServiceKeys(services, filter.countryCode).length > 0;
}

/**
 * The library items a where-to-watch run should check: in the user's library
 * and, when a collection selection is given, in at least one selected
 * collection. `selectedCollectionIds` null/empty means all collections.
 * @param {WatchlistItem[]} items
 * @param {string[] | null} [selectedCollectionIds]
 * @returns {WatchlistItem[]}
 */
export function whereToWatchScopeItems(items, selectedCollectionIds = null) {
  const library = (items || []).filter(isInUserLibrary);
  if (!selectedCollectionIds?.length) return library;
  const selected = new Set(selectedCollectionIds);
  return library.filter((item) => item.collectionIds?.some((id) => selected.has(id)));
}

// ─── Availability cache ──────────────────────────────────────────────────────

/** @returns {{ entries: Object.<string, { t: number, services: ServiceCountryMap }> }} */
export function createEmptyAvailabilityCache() {
  return { entries: {} };
}

export function getFreshAvailability(cache, entryKey, now = Date.now()) {
  const entry = cache?.entries?.[entryKey];
  if (!entry || typeof entry.t !== 'number') return null;
  if (now - entry.t > AVAILABILITY_TTL_MS) return null;
  return entry.services || {};
}

export function setCachedAvailability(cache, entryKey, services, now = Date.now()) {
  cache.entries[entryKey] = { t: now, services };
}

/**
 * Drop expired entries, then the oldest entries beyond `maxEntries`. Mutates
 * and returns the cache.
 */
export function pruneAvailabilityCache(
  cache,
  { maxEntries = AVAILABILITY_CACHE_MAX_ENTRIES, ttlMs = AVAILABILITY_TTL_MS, now = Date.now() } = {},
) {
  const kept = Object.entries(cache.entries).filter(
    ([, entry]) => entry && typeof entry.t === 'number' && now - entry.t <= ttlMs,
  );
  kept.sort((a, b) => b[1].t - a[1].t);
  cache.entries = Object.fromEntries(kept.slice(0, maxEntries));
  return cache;
}

export async function loadAvailabilityCache(storage = AsyncStorage) {
  try {
    const raw = await storage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return createEmptyAvailabilityCache();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.entries !== 'object') {
      return createEmptyAvailabilityCache();
    }
    return { entries: parsed.entries || {} };
  } catch {
    return createEmptyAvailabilityCache();
  }
}

export async function persistAvailabilityCache(cache, storage = AsyncStorage, options = {}) {
  try {
    pruneAvailabilityCache(cache, options);
    await storage.setItem(CACHE_STORAGE_KEY, JSON.stringify({ entries: cache.entries }));
  } catch {
    // A failed cache write only costs re-fetching later; never surface it.
  }
}

// ─── Bulk availability check ─────────────────────────────────────────────────

/**
 * Ensure `cache` holds fresh availability for every item, fetching misses via
 * `fetchAvailability(mediaType, tmdbId)`. Per-item failures are counted, not
 * thrown, so one bad title (or going offline mid-run) still yields a usable
 * partial result.
 *
 * @param {WatchlistItem[]} items
 * @param {{
 *   cache: ReturnType<typeof createEmptyAvailabilityCache>,
 *   fetchAvailability: (mediaType: string, tmdbId: number) => Promise<object>,
 *   concurrency?: number,
 *   onProgress?: (progress: { checked: number, total: number }) => void,
 *   shouldContinue?: () => boolean,
 *   now?: () => number,
 * }} options
 * @returns {Promise<{ checked: number, fetched: number, failed: number, cancelled: boolean }>}
 */
export async function ensureAvailabilityForItems(
  items,
  { cache, fetchAvailability, concurrency = 4, onProgress, shouldContinue, now = Date.now },
) {
  const queue = items.filter((item) => watchlistEntryKey(item));
  const total = queue.length;
  let checked = 0;
  let fetched = 0;
  let failed = 0;
  let cancelled = false;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < queue.length) {
      if (shouldContinue && !shouldContinue()) {
        cancelled = true;
        return;
      }
      const item = queue[nextIndex];
      nextIndex += 1;
      const entryKey = watchlistEntryKey(item);

      if (!getFreshAvailability(cache, entryKey, now())) {
        try {
          const availability = await fetchAvailability(item.mediaType, item.tmdbId);
          setCachedAvailability(cache, entryKey, compactAvailabilityServices(availability), now());
          fetched += 1;
        } catch {
          failed += 1;
        }
      }

      checked += 1;
      onProgress?.({ checked, total });
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, () =>
    worker(),
  );
  await Promise.all(workers);

  return { checked, fetched, failed, cancelled };
}

// ─── Filter preferences ──────────────────────────────────────────────────────

/**
 * Last-used country/service, so the filter opens the way the user left it.
 * Collection selection intentionally resets to "all" each session.
 */
export async function loadWhereToWatchPrefs(storage = AsyncStorage) {
  const fallback = {
    countryCode: DEFAULT_WHERE_TO_WATCH_COUNTRY.code,
    countryLabel: DEFAULT_WHERE_TO_WATCH_COUNTRY.label,
    serviceKey: null,
  };
  try {
    const raw = await storage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.countryCode !== 'string' || !parsed.countryCode.trim()) {
      return fallback;
    }
    return {
      countryCode: parsed.countryCode,
      countryLabel:
        typeof parsed.countryLabel === 'string' && parsed.countryLabel.trim()
          ? parsed.countryLabel
          : parsed.countryCode,
      serviceKey:
        typeof parsed.serviceKey === 'string' && SERVICE_LABELS[parsed.serviceKey]
          ? parsed.serviceKey
          : null,
    };
  } catch {
    return fallback;
  }
}

export async function saveWhereToWatchPrefs(prefs, storage = AsyncStorage) {
  try {
    await storage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({
        countryCode: prefs.countryCode,
        countryLabel: prefs.countryLabel,
        serviceKey: prefs.serviceKey || null,
      }),
    );
  } catch {
    // Losing the pref only means the filter reopens with defaults.
  }
}
