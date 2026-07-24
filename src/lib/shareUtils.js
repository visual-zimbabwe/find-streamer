export const SERVICE_COLORS = {
  netflix: '#E50914',
  amazon_prime_video: '#00A8E1',
  max: '#002BE7',
  paramount_plus: '#0064FF',
  cbc_gem: '#E31B23',
  bbc_iplayer: '#FF4C98',
  channel_4: '#00AEEF',
  itvx: '#DE00FF',
  sbs_on_demand: '#00AEEF',
  abc_iview: '#00A3E0',
};

export const SERVICE_ICONS = {
  netflix: 'play-circle',
  amazon_prime_video: 'logo-amazon',
  max: 'tv',
  paramount_plus: 'tv-outline',
  cbc_gem: 'tv-outline',
  bbc_iplayer: 'tv-outline',
  channel_4: 'tv-outline',
  itvx: 'tv-outline',
  sbs_on_demand: 'tv-outline',
  abc_iview: 'tv-outline',
};

// Ordered by streaming-market size – used when US/CA aren't available.
export const POPULARITY_ORDER = [
  'US',
  'CA',
  'GB',
  'AU',
  'DE',
  'FR',
  'BR',
  'MX',
  'JP',
  'IN',
  'ES',
  'IT',
  'NL',
  'KR',
  'SE',
  'NO',
  'DK',
  'PL',
  'AR',
  'CO',
  'CL',
  'PT',
  'ZA',
  'SG',
  'TR',
  'CH',
  'BE',
  'AT',
  'FI',
  'HU',
  'CZ',
  'RO',
  'GR',
  'IE',
  'NZ',
  'IL',
  'TH',
  'PH',
  'MY',
  'HK',
  'TW',
  'VN',
  'ID',
  'EG',
  'NG',
];

export const SHORT_COUNTRY_NAMES = {
  US: 'USA',
  CA: 'Canada',
  GB: 'UK',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  BR: 'Brazil',
  MX: 'Mexico',
  JP: 'Japan',
  IN: 'India',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  KR: 'S. Korea',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  PL: 'Poland',
  AR: 'Argentina',
  CO: 'Colombia',
  CL: 'Chile',
  PT: 'Portugal',
  ZA: 'S. Africa',
  SG: 'Singapore',
  TR: 'Turkey',
  CH: 'Switzerland',
  BE: 'Belgium',
  AT: 'Austria',
  FI: 'Finland',
  HU: 'Hungary',
  CZ: 'Czechia',
  RO: 'Romania',
  GR: 'Greece',
  IE: 'Ireland',
  NZ: 'N. Zealand',
  IL: 'Israel',
  TH: 'Thailand',
  PH: 'Philippines',
  MY: 'Malaysia',
  HK: 'Hong Kong',
  TW: 'Taiwan',
  VN: 'Vietnam',
  ID: 'Indonesia',
  EG: 'Egypt',
  NG: 'Nigeria',
};

/**
 * Display labels + a search haystack for every country in `rows`.
 *
 * SHORT_COUNTRY_NAMES exists to keep the busiest markets narrow on the card
 * ("USA", not "United States of America"), but it only covers ~45 of them, so
 * everything past it used to render as a bare ISO code. The rows already carry
 * TMDb's English country name (see getCountryNames in lib/tmdb), so use that as
 * the fallback rather than shipping a second copy of ISO 3166-1.
 *
 * The haystack keeps the full name even where a short name overrides it, so
 * searching "united" still finds USA and UK.
 */
export function buildCountryIndex(rows) {
  const labels = {};
  const haystacks = {};
  (rows || []).forEach((row) => {
    const code = row?.code;
    if (!code) return;
    const full = row.country && row.country !== code ? row.country : null;
    labels[code] = SHORT_COUNTRY_NAMES[code] || full || code;
    haystacks[code] = [code, SHORT_COUNTRY_NAMES[code], full]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  });
  return { labels, haystacks };
}

export function shortName(code, labels) {
  return (labels && labels[code]) || SHORT_COUNTRY_NAMES[code] || code;
}

/**
 * Filter country codes by a free-text query against name, short name and code.
 */
export function filterCountryCodes(codes, query, index) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return codes;
  return (codes || []).filter((code) => {
    const hay =
      index?.haystacks?.[code] || `${code} ${SHORT_COUNTRY_NAMES[code] || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

/**
 * The chips a collapsed service section shows: the `limit` most popular
 * countries, plus any current selection that falls outside them. Without the
 * pinning, a pick made while expanded — or an auto-pick for a title that streams
 * nowhere popular — would vanish and become impossible to clear.
 */
export function collapseCountryList(codes, selected, limit) {
  const all = codes || [];
  if (all.length <= limit) return all;
  const head = all.slice(0, limit);
  const pinned = (selected || []).filter((code) => all.includes(code) && !head.includes(code));
  return [...head, ...pinned];
}

/**
 * Pick at most 2 countries for a service.
 * Priority: US → CA → top of POPULARITY_ORDER → any remaining.
 */
export function pickCountries(rows, serviceKey) {
  const available = new Set((rows || []).filter((r) => r.providers[serviceKey]).map((r) => r.code));
  if (available.size === 0) return [];

  const picked = [];
  if (available.has('US')) picked.push('US');
  if (picked.length < 2 && available.has('CA')) picked.push('CA');

  for (const code of POPULARITY_ORDER) {
    if (picked.length >= 2) break;
    if (!picked.includes(code) && available.has(code)) picked.push(code);
  }
  for (const code of available) {
    if (picked.length >= 2) break;
    if (!picked.includes(code)) picked.push(code);
  }
  return picked;
}

/**
 * All countries where a service is available, sorted by POPULARITY_ORDER.
 */
export function getAvailableCountriesForService(rows, serviceKey) {
  const codes = (rows || []).filter((r) => r.providers[serviceKey]).map((r) => r.code);
  return [...codes].sort((a, b) => {
    const ai = POPULARITY_ORDER.indexOf(a);
    const bi = POPULARITY_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

/**
 * Build the default selectedCountries object for all services.
 */
export function buildDefaultSelectedCountries(providerSummary, rows) {
  const out = {};
  (providerSummary || [])
    .filter((p) => p.count > 0)
    .forEach((p) => {
      out[p.key] = pickCountries(rows, p.key);
    });
  return out;
}
