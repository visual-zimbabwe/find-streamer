export const SERVICE_COLORS = {
  netflix: '#E50914',
  amazon_prime_video: '#00A8E1',
  max: '#002BE7',
  cbc_gem: '#E31B23',
  bbc_iplayer: '#FF4C98',
};

export const SERVICE_ICONS = {
  netflix: 'play-circle',
  amazon_prime_video: 'logo-amazon',
  max: 'tv',
  cbc_gem: 'tv-outline',
  bbc_iplayer: 'tv-outline',
};

// Ordered by streaming-market size – used when US/CA aren't available.
export const POPULARITY_ORDER = [
  'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'BR', 'MX', 'JP', 'IN',
  'ES', 'IT', 'NL', 'KR', 'SE', 'NO', 'DK', 'PL', 'AR', 'CO',
  'CL', 'PT', 'ZA', 'SG', 'TR', 'CH', 'BE', 'AT', 'FI', 'HU',
  'CZ', 'RO', 'GR', 'IE', 'NZ', 'IL', 'TH', 'PH', 'MY', 'HK',
  'TW', 'VN', 'ID', 'EG', 'NG',
];

export const SHORT_COUNTRY_NAMES = {
  US: 'USA',      CA: 'Canada',    GB: 'UK',          AU: 'Australia',
  DE: 'Germany',  FR: 'France',    BR: 'Brazil',      MX: 'Mexico',
  JP: 'Japan',    IN: 'India',     ES: 'Spain',       IT: 'Italy',
  NL: 'Netherlands', KR: 'S. Korea', SE: 'Sweden',   NO: 'Norway',
  DK: 'Denmark',  PL: 'Poland',    AR: 'Argentina',   CO: 'Colombia',
  CL: 'Chile',    PT: 'Portugal',  ZA: 'S. Africa',   SG: 'Singapore',
  TR: 'Turkey',   CH: 'Switzerland', BE: 'Belgium',   AT: 'Austria',
  FI: 'Finland',  HU: 'Hungary',   CZ: 'Czechia',     RO: 'Romania',
  GR: 'Greece',   IE: 'Ireland',   NZ: 'N. Zealand',  IL: 'Israel',
  TH: 'Thailand', PH: 'Philippines', MY: 'Malaysia',  HK: 'Hong Kong',
  TW: 'Taiwan',   VN: 'Vietnam',   ID: 'Indonesia',   EG: 'Egypt',
  NG: 'Nigeria',
};

export function shortName(code) {
  return SHORT_COUNTRY_NAMES[code] || code;
}

/**
 * Pick at most 2 countries for a service.
 * Priority: US → CA → top of POPULARITY_ORDER → any remaining.
 */
export function pickCountries(rows, serviceKey) {
  const available = new Set(
    (rows || []).filter(r => r.providers[serviceKey]).map(r => r.code)
  );
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
  const codes = (rows || [])
    .filter(r => r.providers[serviceKey])
    .map(r => r.code);
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
  (providerSummary || []).filter(p => p.count > 0).forEach(p => {
    out[p.key] = pickCountries(rows, p.key);
  });
  return out;
}
