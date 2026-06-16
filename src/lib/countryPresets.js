/**
 * ─── Country Presets by Continent ─────────────────────────────────────────────
 *
 * Each preset maps to a curated set of ISO 3166-1 alpha-2 country codes that
 * TMDB supports via the `with_origin_country` query parameter (TV only).
 *
 * Design principles:
 *  - Coverage is based on TMDB content availability, not strict political
 *    geography. Disputed territories are placed in their most common grouping.
 *  - The goal is to help the user narrow down the country picker to a
 *    manageable continent-level list, not to exclude edge-cases perfectly.
 *
 * References:
 *  - TMDB ISO 3166-1 country list: https://developer.themoviedb.org/reference/configuration-countries
 */

// ─── Continent Presets ─────────────────────────────────────────────────────────

export const COUNTRY_PRESETS = [
  {
    id: 'africa',
    label: 'Africa 🌍',
    emoji: '🌍',
    description:
      'Algeria, Egypt, Ethiopia, Ghana, Kenya, Morocco, Nigeria, Senegal, South Africa, Tanzania, Tunisia, Uganda, Zimbabwe, and more.',
    codes: [
      'DZ', // Algeria
      'AO', // Angola
      'BJ', // Benin
      'BW', // Botswana
      'BF', // Burkina Faso
      'BI', // Burundi
      'CM', // Cameroon
      'CV', // Cape Verde
      'CF', // Central African Republic
      'TD', // Chad
      'KM', // Comoros
      'CD', // Democratic Republic of the Congo
      'CG', // Republic of the Congo
      'CI', // Côte d'Ivoire
      'DJ', // Djibouti
      'EG', // Egypt
      'GQ', // Equatorial Guinea
      'ER', // Eritrea
      'ET', // Ethiopia
      'GA', // Gabon
      'GM', // Gambia
      'GH', // Ghana
      'GN', // Guinea
      'GW', // Guinea-Bissau
      'KE', // Kenya
      'LS', // Lesotho
      'LR', // Liberia
      'LY', // Libya
      'MG', // Madagascar
      'MW', // Malawi
      'ML', // Mali
      'MR', // Mauritania
      'MU', // Mauritius
      'MA', // Morocco
      'MZ', // Mozambique
      'NA', // Namibia
      'NE', // Niger
      'NG', // Nigeria
      'RW', // Rwanda
      'ST', // São Tomé and Príncipe
      'SN', // Senegal
      'SC', // Seychelles
      'SL', // Sierra Leone
      'SO', // Somalia
      'ZA', // South Africa
      'SS', // South Sudan
      'SD', // Sudan
      'SZ', // Eswatini
      'TZ', // Tanzania
      'TG', // Togo
      'TN', // Tunisia
      'UG', // Uganda
      'ZM', // Zambia
      'ZW', // Zimbabwe
    ],
  },
  {
    id: 'asia',
    label: 'Asia 🌏',
    emoji: '🌏',
    description:
      'China, India, Indonesia, Japan, South Korea, Thailand, Vietnam, Pakistan, Philippines, and more.',
    codes: [
      'AF', // Afghanistan
      'AM', // Armenia
      'AZ', // Azerbaijan
      'BH', // Bahrain
      'BD', // Bangladesh
      'BT', // Bhutan
      'BN', // Brunei
      'KH', // Cambodia
      'CN', // China
      'CY', // Cyprus
      'GE', // Georgia
      'HK', // Hong Kong
      'IN', // India
      'ID', // Indonesia
      'IR', // Iran
      'IQ', // Iraq
      'IL', // Israel
      'JP', // Japan
      'JO', // Jordan
      'KZ', // Kazakhstan
      'KW', // Kuwait
      'KG', // Kyrgyzstan
      'LA', // Laos
      'LB', // Lebanon
      'MO', // Macao
      'MY', // Malaysia
      'MV', // Maldives
      'MN', // Mongolia
      'MM', // Myanmar
      'NP', // Nepal
      'KP', // North Korea
      'OM', // Oman
      'PK', // Pakistan
      'PS', // Palestine
      'PH', // Philippines
      'QA', // Qatar
      'SA', // Saudi Arabia
      'SG', // Singapore
      'LK', // Sri Lanka
      'SY', // Syria
      'TW', // Taiwan
      'TJ', // Tajikistan
      'TH', // Thailand
      'TL', // Timor-Leste
      'TM', // Turkmenistan
      'AE', // United Arab Emirates
      'UZ', // Uzbekistan
      'VN', // Vietnam
      'YE', // Yemen
      'KR', // South Korea
    ],
  },
  {
    id: 'europe',
    label: 'Europe 🌍',
    emoji: '🌍',
    description: 'France, Germany, Italy, Spain, UK, Scandinavia, Eastern Europe, and more.',
    codes: [
      'AL', // Albania
      'AD', // Andorra
      'AT', // Austria
      'BY', // Belarus
      'BE', // Belgium
      'BA', // Bosnia and Herzegovina
      'BG', // Bulgaria
      'HR', // Croatia
      'CZ', // Czech Republic
      'DK', // Denmark
      'EE', // Estonia
      'FI', // Finland
      'FR', // France
      'DE', // Germany
      'GR', // Greece
      'HU', // Hungary
      'IS', // Iceland
      'IE', // Ireland
      'IT', // Italy
      'XK', // Kosovo
      'LV', // Latvia
      'LI', // Liechtenstein
      'LT', // Lithuania
      'LU', // Luxembourg
      'MT', // Malta
      'MD', // Moldova
      'MC', // Monaco
      'ME', // Montenegro
      'NL', // Netherlands
      'MK', // North Macedonia
      'NO', // Norway
      'PL', // Poland
      'PT', // Portugal
      'RO', // Romania
      'RU', // Russia
      'SM', // San Marino
      'RS', // Serbia
      'SK', // Slovakia
      'SI', // Slovenia
      'ES', // Spain
      'SE', // Sweden
      'CH', // Switzerland
      'UA', // Ukraine
      'GB', // United Kingdom
      'VA', // Vatican City
    ],
  },
  {
    id: 'north_america',
    label: 'North America 🌎',
    emoji: '🌎',
    description: 'USA, Canada, Mexico, Central America, and the Caribbean.',
    codes: [
      'AG', // Antigua and Barbuda
      'BS', // Bahamas
      'BB', // Barbados
      'BZ', // Belize
      'CA', // Canada
      'CR', // Costa Rica
      'CU', // Cuba
      'DM', // Dominica
      'DO', // Dominican Republic
      'SV', // El Salvador
      'GD', // Grenada
      'GT', // Guatemala
      'HT', // Haiti
      'HN', // Honduras
      'JM', // Jamaica
      'MX', // Mexico
      'NI', // Nicaragua
      'PA', // Panama
      'KN', // Saint Kitts and Nevis
      'LC', // Saint Lucia
      'VC', // Saint Vincent and the Grenadines
      'TT', // Trinidad and Tobago
      'US', // United States
    ],
  },
  {
    id: 'latin_america',
    label: 'Latin America 🌎',
    emoji: '🌎',
    description:
      'Mexico, Central America, the Caribbean, Brazil, Argentina, Colombia, Chile, Peru, Venezuela, and more.',
    codes: [
      'MX', // Mexico
      'BZ', // Belize
      'CR', // Costa Rica
      'SV', // El Salvador
      'GT', // Guatemala
      'HN', // Honduras
      'NI', // Nicaragua
      'PA', // Panama
      'CU', // Cuba
      'DO', // Dominican Republic
      'HT', // Haiti
      'JM', // Jamaica
      'PR', // Puerto Rico
      'TT', // Trinidad and Tobago
      'AR', // Argentina
      'BO', // Bolivia
      'BR', // Brazil
      'CL', // Chile
      'CO', // Colombia
      'EC', // Ecuador
      'GY', // Guyana
      'PY', // Paraguay
      'PE', // Peru
      'SR', // Suriname
      'UY', // Uruguay
      'VE', // Venezuela
    ],
  },
  {
    id: 'south_america',
    label: 'South America 🌎',
    emoji: '🌎',
    description: 'Brazil, Argentina, Colombia, Chile, Peru, Venezuela, and more.',
    codes: [
      'AR', // Argentina
      'BO', // Bolivia
      'BR', // Brazil
      'CL', // Chile
      'CO', // Colombia
      'EC', // Ecuador
      'GY', // Guyana
      'PY', // Paraguay
      'PE', // Peru
      'SR', // Suriname
      'UY', // Uruguay
      'VE', // Venezuela
    ],
  },
  {
    id: 'oceania',
    label: 'Oceania 🌏',
    emoji: '🌏',
    description: 'Australia, New Zealand, Papua New Guinea, Pacific Island nations.',
    codes: [
      'AU', // Australia
      'FJ', // Fiji
      'KI', // Kiribati
      'MH', // Marshall Islands
      'FM', // Micronesia
      'NR', // Nauru
      'NZ', // New Zealand
      'PW', // Palau
      'PG', // Papua New Guinea
      'WS', // Samoa
      'SB', // Solomon Islands
      'TO', // Tonga
      'TV', // Tuvalu
      'VU', // Vanuatu
    ],
  },
  {
    id: 'middle_east',
    label: 'Middle East 🕌',
    emoji: '🕌',
    description:
      'Saudi Arabia, UAE, Turkey, Iran, Iraq, Israel, Jordan, Kuwait, Lebanon, Qatar, and more.',
    codes: [
      'AE', // United Arab Emirates
      'BH', // Bahrain
      'IL', // Israel
      'IQ', // Iraq
      'IR', // Iran
      'JO', // Jordan
      'KW', // Kuwait
      'LB', // Lebanon
      'OM', // Oman
      'PS', // Palestine
      'QA', // Qatar
      'SA', // Saudi Arabia
      'SY', // Syria
      'TR', // Turkey
      'YE', // Yemen
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the flat array of ISO 3166-1 codes for a given continent preset id. */
export function codesForCountryPreset(presetId) {
  const preset = COUNTRY_PRESETS.find((p) => p.id === presetId);
  return preset ? preset.codes : [];
}

/** Returns the preset object by id. */
export function findCountryPreset(presetId) {
  return COUNTRY_PRESETS.find((p) => p.id === presetId) || null;
}

/**
 * Given an active preset id and the full countries list from TMDB,
 * returns only the countries that belong to that continent.
 * If no preset is active, returns the full list.
 */
export function filterCountriesByPreset(allCountries, presetId) {
  if (!presetId) return allCountries;
  const codes = new Set(codesForCountryPreset(presetId));
  // Always keep the "Any Country" sentinel (code === null)
  return allCountries.filter((c) => c.code === null || codes.has(c.code));
}
