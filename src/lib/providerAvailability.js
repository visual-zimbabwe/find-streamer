// Pure helpers for turning TMDB `watch/providers` responses into a per-service,
// per-country availability map. Extracted from tmdb.js so the region-locking and
// bucket-collection behavior can be exercised directly by unit tests without the
// surrounding network layer.

export const SERVICE_LABELS = {
  netflix: 'Netflix',
  amazon_prime_video: 'Prime Video',
  max: 'Max',
  paramount_plus: 'Paramount+',
  cbc_gem: 'CBC Gem',
  bbc_iplayer: 'BBC iPlayer',
  channel_4: 'Channel 4',
  itvx: 'ITVX',
  sbs_on_demand: 'SBS On Demand',
  abc_iview: 'ABC iview',
};

const DIRECT_SERVICE_NAMES = {
  netflix: new Set(['netflix', 'netflix standard with ads', 'netflix basic with ads']),
  amazon_prime_video: new Set(['amazon prime video']),
  max: new Set(['max', 'hbo max']),
  paramount_plus: new Set(['paramount plus essential']),
  cbc_gem: new Set(['cbc gem']),
  bbc_iplayer: new Set(['bbc iplayer']),
  channel_4: new Set(['channel 4']),
  itvx: new Set(['itvx']),
  sbs_on_demand: new Set(['sbs on demand']),
  abc_iview: new Set(['abc iview']),
};

// Services that only legitimately exist in a single market. TMDB occasionally
// reports them in other regions; we hard-gate those to avoid misleading the user.
const REGION_LOCKED_SERVICES = {
  paramount_plus: new Set(['US']),
  cbc_gem: new Set(['CA']),
  bbc_iplayer: new Set(['GB']),
  channel_4: new Set(['GB']),
  itvx: new Set(['GB']),
  sbs_on_demand: new Set(['AU']),
  abc_iview: new Set(['AU']),
};

// TMDB groups providers by monetization type. We treat flat-rate subscription,
// free, and ad-supported buckets as "streaming"; rent/buy are intentionally
// excluded.
export const STREAMING_PROVIDER_BUCKETS = ['flatrate', 'free', 'ads'];

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

export function serviceKey(providerName) {
  const name = normalize(providerName);
  for (const [key, directNames] of Object.entries(DIRECT_SERVICE_NAMES)) {
    if (directNames.has(name)) return key;
  }
  return null;
}

export function directStreamingServices(info = {}) {
  const matched = new Map();
  STREAMING_PROVIDER_BUCKETS.forEach((bucket) => {
    (info[bucket] || []).forEach((provider) => {
      const key = serviceKey(provider.provider_name || '');
      if (key && !matched.has(key)) {
        matched.set(key, provider.logo_path || null);
      }
    });
  });
  return matched;
}

const REGIONAL_INDICATOR_A = 0x1f1e6;
const LATIN_A = 'A'.charCodeAt(0);

/**
 * 'CA' → 🇨🇦. Flags carry most of the scanning load in a long country list.
 * Returns '' for anything that is not a two-letter code, so callers can render
 * the result unconditionally.
 */
export function flagForCountryCode(code) {
  if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((char) => REGIONAL_INDICATOR_A + char.charCodeAt(0) - LATIN_A),
  );
}

/**
 * Display labels for the services an availability row streams on, in
 * `SERVICE_LABELS` order so every row lists them consistently.
 */
export function serviceLabelsForRow(row) {
  if (!row?.providers) return [];
  return Object.entries(SERVICE_LABELS)
    .filter(([key]) => row.providers[key])
    .map(([, label]) => label);
}

export function emptyServiceMap(valueFactory) {
  return Object.fromEntries(Object.keys(SERVICE_LABELS).map((key) => [key, valueFactory()]));
}

export function isServiceAvailableInRegion(key, countryCode) {
  const allowedRegions = REGION_LOCKED_SERVICES[key];
  return !allowedRegions || allowedRegions.has(countryCode);
}

/**
 * Fold a list of per-episode `watch/providers` payloads into one availability
 * map where a country only counts if *every* episode streams there. Logo paths
 * are written into `logos` as a side effect so one map can be shared across
 * several folds (e.g. per-season and show-level).
 *
 * An empty list yields empty country lists, not "available everywhere".
 */
export function intersectEpisodeAvailability(
  episodeResults = [],
  logos = emptyServiceMap(() => null),
) {
  const availability = emptyServiceMap(() => null);

  episodeResults.forEach((data) => {
    const episodeAvailability = emptyServiceMap(() => new Set());

    Object.entries(data?.results || {}).forEach(([countryCode, info]) => {
      directStreamingServices(info).forEach((logoPath, key) => {
        if (!isServiceAvailableInRegion(key, countryCode)) return;
        episodeAvailability[key].add(countryCode);
        if (!logos[key] && logoPath) logos[key] = logoPath;
      });
    });

    Object.keys(availability).forEach((key) => {
      if (availability[key] === null) {
        availability[key] = episodeAvailability[key];
      } else {
        availability[key] = new Set(
          [...availability[key]].filter((code) => episodeAvailability[key].has(code)),
        );
      }
    });
  });

  return Object.fromEntries(
    Object.entries(availability).map(([key, countryCodes]) => [
      key,
      Array.from(countryCodes || []).sort(),
    ]),
  );
}

/**
 * The same fold, grouped by season: `{ [seasonNumber]: availabilityMap }`.
 * `episodes[i]` must describe `episodeResults[i]` — both come out of the same
 * ordered fan-out, so the index is the join key.
 */
export function availabilityBySeason(
  episodes = [],
  episodeResults = [],
  logos = emptyServiceMap(() => null),
) {
  const grouped = new Map();

  episodes.forEach((episode, index) => {
    const seasonNumber = episode?.seasonNumber;
    if (seasonNumber == null) return;
    if (!grouped.has(seasonNumber)) grouped.set(seasonNumber, []);
    grouped.get(seasonNumber).push(episodeResults[index]);
  });

  const bySeason = {};
  for (const [seasonNumber, results] of grouped) {
    bySeason[seasonNumber] = intersectEpisodeAvailability(results, logos);
  }
  return bySeason;
}

/**
 * Collapse per-season availability back to one show-level map. Intersecting the
 * season intersections is the same answer as intersecting every episode at
 * once, so show-level behavior is unchanged by the season split.
 */
export function intersectSeasonAvailability(bySeason = {}) {
  const seasons = Object.values(bySeason);
  if (!seasons.length) return emptyServiceMap(() => []);

  return Object.fromEntries(
    Object.keys(SERVICE_LABELS).map((key) => {
      const [first, ...rest] = seasons.map((season) => new Set(season?.[key] || []));
      return [
        key,
        [...first].filter((countryCode) => rest.every((set) => set.has(countryCode))).sort(),
      ];
    }),
  );
}

export function availabilityFromResults(results = {}) {
  const availability = emptyServiceMap(() => []);
  const logos = emptyServiceMap(() => null);

  Object.entries(results).forEach(([countryCode, info]) => {
    directStreamingServices(info).forEach((logoPath, key) => {
      if (!isServiceAvailableInRegion(key, countryCode)) return;
      availability[key].push(countryCode);
      if (!logos[key] && logoPath) logos[key] = logoPath;
    });
  });

  Object.keys(availability).forEach((key) => {
    availability[key] = Array.from(new Set(availability[key])).sort();
  });

  return { ...availability, logos };
}
