// Pure helpers for turning TMDB `watch/providers` responses into a per-service,
// per-country availability map. Extracted from tmdb.js so the region-locking and
// bucket-collection behavior can be exercised directly by unit tests without the
// surrounding network layer.

export const SERVICE_LABELS = {
  netflix: 'Netflix',
  amazon_prime_video: 'Prime Video',
  max: 'Max',
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

export function emptyServiceMap(valueFactory) {
  return Object.fromEntries(Object.keys(SERVICE_LABELS).map((key) => [key, valueFactory()]));
}

export function isServiceAvailableInRegion(key, countryCode) {
  const allowedRegions = REGION_LOCKED_SERVICES[key];
  return !allowedRegions || allowedRegions.has(countryCode);
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
