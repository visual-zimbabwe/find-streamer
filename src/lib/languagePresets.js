/**
 * ─── Language Presets by Region ───────────────────────────────────────────────
 *
 * Each preset expands to a curated list of ISO 639-1 language codes that TMDB
 * supports via the `with_original_language` query parameter.
 *
 * Design principles:
 *  - Codes are chosen based on practical TMDB content coverage, not strict
 *    geographic rules. A language that spans multiple regions is placed in the
 *    most discovery-useful grouping.
 *  - Languages not reliably representable through TMDB's language model are
 *    omitted or grouped under broader presets and flagged as smart filters.
 *  - Special presets (excludeEnglish, nonEnglishOnly) are semantic toggles
 *    handled separately from region codes.
 *
 * References:
 *  - TMDB ISO 639-1 language list: https://developer.themoviedb.org/reference/configuration-languages
 *  - Known TMDB language imprecision: https://github.com/Radarr/Radarr/issues/7788
 */

// ─── Canonical Regional Language Code Sets ────────────────────────────────────

/**
 * All 23 non-English official working languages of the 27 European Union member
 * states, plus national/co-official EU languages with TMDB catalog coverage
 * (Luxembourgish, Catalan, Basque, Galician). Strictly excludes English ('en').
 */
export const EU_LANGUAGE_CODES = [
  'bg', // Bulgarian (Bulgaria)
  'hr', // Croatian (Croatia)
  'cs', // Czech (Czechia)
  'da', // Danish (Denmark)
  'nl', // Dutch (Netherlands, Belgium)
  'et', // Estonian (Estonia)
  'fi', // Finnish (Finland)
  'fr', // French (France, Belgium, Luxembourg)
  'de', // German (Germany, Austria, Belgium, Luxembourg)
  'el', // Greek (Greece, Cyprus)
  'hu', // Hungarian (Hungary)
  'ga', // Irish (Ireland)
  'it', // Italian (Italy)
  'lv', // Latvian (Latvia)
  'lt', // Lithuanian (Lithuania)
  'mt', // Maltese (Malta)
  'pl', // Polish (Poland)
  'pt', // Portuguese (Portugal)
  'ro', // Romanian (Romania)
  'sk', // Slovak (Slovakia)
  'sl', // Slovenian (Slovenia)
  'es', // Spanish (Spain)
  'sv', // Swedish (Sweden, Finland)
  'lb', // Luxembourgish (Luxembourg)
  'ca', // Catalan (Spain)
  'eu', // Basque (Spain, France)
  'gl', // Galician (Spain)
];

/**
 * Languages of Middle Eastern countries.
 */
export const MIDDLE_EAST_LANGUAGE_CODES = [
  'ar', // Arabic
  'fa', // Persian / Farsi
  'tr', // Turkish
  'he', // Hebrew
  'ku', // Kurdish
];

/**
 * Languages of East, South, Southeast, and Central Asian countries.
 */
export const ASIA_LANGUAGE_CODES = [
  'ko', // Korean
  'ja', // Japanese
  'zh', // Mandarin Chinese
  'cn', // Cantonese
  'hi', // Hindi
  'ta', // Tamil
  'te', // Telugu
  'ml', // Malayalam
  'kn', // Kannada
  'bn', // Bengali
  'mr', // Marathi
  'pa', // Punjabi
  'gu', // Gujarati
  'or', // Odia
  'as', // Assamese
  'ur', // Urdu
  'si', // Sinhala
  'ne', // Nepali
  'th', // Thai
  'vi', // Vietnamese
  'id', // Indonesian
  'ms', // Malay
  'tl', // Tagalog / Filipino
  'km', // Khmer
  'lo', // Lao
  'my', // Burmese
  'mn', // Mongolian
  'bo', // Tibetan
  'kk', // Kazakh
  'uz', // Uzbek
];

/**
 * Languages of African countries.
 */
export const AFRICA_LANGUAGE_CODES = [
  'af', // Afrikaans
  'sw', // Swahili
  'am', // Amharic
  'so', // Somali
  'wo', // Wolof
  'yo', // Yoruba
  'ig', // Igbo
  'ha', // Hausa
  'zu', // Zulu
  'xh', // Xhosa
  'st', // Sotho
  'tn', // Tswana
  'sn', // Shona
  'rw', // Kinyarwanda
  'rn', // Kirundi
  'lg', // Luganda
  'ny', // Chichewa
  'mg', // Malagasy
  'ti', // Tigrinya
  'om', // Oromo
  'ak', // Akan
  'tw', // Twi
  'bm', // Bambara
  'ee', // Ewe
  'ff', // Fulah
  'ln', // Lingala
];

/**
 * Nordic / Scandinavian languages.
 */
export const NORDIC_LANGUAGE_CODES = [
  'da', // Danish
  'sv', // Swedish
  'no', // Norwegian
  'nb', // Norwegian Bokmål
  'nn', // Norwegian Nynorsk
  'fi', // Finnish
  'is', // Icelandic
];

/**
 * Latin American primary languages.
 */
export const LATIN_AMERICA_LANGUAGE_CODES = [
  'es', // Spanish
  'pt', // Portuguese
];

// ─── Region Presets ───────────────────────────────────────────────────────────

export const REGION_PRESETS = [
  {
    id: 'eu',
    label: 'European Union',
    emoji: '',
    description:
      'All 23 non-English official EU languages (French, Spanish, German, Italian, Danish, Swedish, Dutch, Polish, Portuguese, Greek, Czech, Finnish, Hungarian, Romanian, Irish, Maltese, and more).',
    codes: EU_LANGUAGE_CODES,
    smartFilter: false,
  },
  {
    id: 'europe',
    label: 'Europe',
    emoji: '',
    description:
      'French, Spanish, German, Italian, Portuguese, Russian, Polish, Dutch, Swedish, Norwegian, Danish, Finnish, Czech, Romanian, Greek, Hungarian, Ukrainian',
    codes: [
      ...EU_LANGUAGE_CODES,
      'ru',
      'no',
      'nb',
      'nn',
      'is',
      'uk',
      'sr',
      'bs',
      'sq',
      'mk',
      'be',
      'cy',
    ],
    smartFilter: false,
  },
  {
    id: 'nordic',
    label: 'Nordic',
    emoji: '',
    description: 'Danish, Swedish, Norwegian, Finnish, Icelandic',
    codes: NORDIC_LANGUAGE_CODES,
    smartFilter: false,
  },
  {
    id: 'asia',
    label: 'Asia',
    emoji: '',
    description:
      'Korean, Japanese, Mandarin Chinese, Cantonese, Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Punjabi, Sinhala, Nepali, Urdu, Thai, Vietnamese, Indonesian, Malay, Tagalog/Filipino',
    codes: ASIA_LANGUAGE_CODES,
    smartFilter: true,
    smartFilterNote:
      "TMDB uses 'zh' broadly for Chinese content. Mandarin and Cantonese titles may be mixed. Results tagged with 'cn' (Cantonese) are included for broader coverage.",
  },
  {
    id: 'middle_east',
    label: 'Middle East',
    emoji: '',
    description: 'Arabic, Persian/Farsi, Turkish, Hebrew, Kurdish',
    codes: MIDDLE_EAST_LANGUAGE_CODES,
    smartFilter: true,
    smartFilterNote:
      'Arabic content uses a broad regional code — results may include films from any Arabic-speaking country.',
  },
  {
    id: 'africa',
    label: 'Africa',
    emoji: '',
    description:
      'Afrikaans, Swahili, Amharic, Somali, Wolof, Yoruba, Igbo, Hausa, Zulu, Xhosa, Sotho, Tswana, Shona, Kinyarwanda, Twi, and more',
    codes: AFRICA_LANGUAGE_CODES,
    smartFilter: true,
    smartFilterNote: 'African language content has limited TMDB coverage. Results may be sparse.',
  },
  {
    id: 'latin_america',
    label: 'Latin America',
    emoji: '',
    description: 'Spanish (Latin American), Portuguese (Brazilian)',
    codes: LATIN_AMERICA_LANGUAGE_CODES,
    smartFilter: true,
    smartFilterNote:
      'Spanish covers both Spain and Latin America. Origin Country scopes results to Latin American nations.',
  },
  {
    id: 'north_america',
    label: 'North America',
    emoji: '',
    description: 'English, French (Canadian)',
    codes: ['en', 'fr'],
    smartFilter: false,
  },
];

// ─── Intent Presets (Airbnb-style "type of place" front door) ─────────────────

/**
 * One-tap starting points expressed the way people actually search for something
 * to watch — by vibe, not by continent. Each preset is a thin `patch` over the
 * existing filter primitives, so it drives the same engine the granular controls
 * do. Presets are matched *statelessly* (see `intentPresetActive`) against the
 * live filters — there is no separate "active preset" flag to fall out of sync
 * when the user edits a control afterwards.
 *
 * A `patch` is fully self-contained for the filter *group* it touches (e.g. a
 * language preset sets both `languageCodes` and `excludeEnglish`) so applying one
 * never leaves a contradictory half-state behind.
 */
// Quick Picks is now personalized: the language chips are derived at runtime from
// the languages in the user's Highly Recommend list (see
// `topWatchlistLanguages` + DiscoverScreen). The only STATIC intent preset left is
// Documentary — a genre shortcut with no personalized equivalent. Language buckets
// (Korean/Bollywood/Anime) moved to Smart Filters; "Foreign" is the Language
// control's Non-English state; "Highly Rated" is the Rating + Sort controls.
export const INTENT_PRESETS = [
  {
    id: 'documentary',
    label: 'Documentary',
    icon: 'videocam-outline',
    // TMDB genre 99 = Documentary (present in both movie and TV genre lists).
    patch: { genreIds: [99], genreLogic: 'AND' },
  },
];

/** Order-insensitive equality for the scalar / array values a patch can hold. */
function presetValuesEqual(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const bSet = new Set(b);
    return a.every((item) => bSet.has(item));
  }
  return a === b;
}

/**
 * True when the live `filters` already satisfy every key in the preset's patch —
 * i.e. the preset is "on". Stateless: derived from the filters themselves.
 */
export function intentPresetActive(preset, filters) {
  return Object.keys(preset.patch).every((key) =>
    presetValuesEqual(filters[key], preset.patch[key]),
  );
}

// ─── Special Presets ──────────────────────────────────────────────────────────

/**
 * Special preset IDs that are not region groupings but semantic toggles.
 * The ViewModel handles these by manipulating excludeEnglish / nonEnglishOnly
 * flags rather than populating languageCodes.
 */
export const SPECIAL_PRESETS = [
  {
    id: 'exclude_english',
    label: 'Exclude English',
    emoji: '',
    description: 'Show results from any language except English.',
    isSpecial: true,
  },
  {
    id: 'non_english_only',
    label: 'Non-English Only',
    emoji: '',
    description:
      'Equivalent to Exclude English — ensures all results have a non-English original language.',
    isSpecial: true,
  },
];

// ─── Language → Country Preset Link Map ──────────────────────────────────────

/**
 * Maps a language preset id to the corresponding country preset id.
 * Used to show the "Also filter by country?" linked-preset banner when the
 * user activates a language preset on the TV view.
 */
export const LANGUAGE_TO_COUNTRY_PRESET = {
  eu: 'eu',
  nordic: 'nordic',
  europe: 'europe',
  asia: 'asia',
  middle_east: 'middle_east',
  africa: 'africa',
  latin_america: 'latin_america',
  north_america: 'north_america',
};

// ─── Non-English Curated Language List ───────────────────────────────────────

/**
 * A curated, stable list of ISO 639-1 codes representing the major
 * non-English content-producing languages on TMDB.
 *
 * This is used by the "Exclude English" / "Non-English" filter and language
 * exclusion set-algebra as a server-side solution for TMDB's lack of a native
 * `without_original_language` parameter.
 *
 * The list is the union of all codes across REGION_PRESETS, minus 'en'.
 */
export const NON_ENGLISH_CODES = Array.from(
  new Set([
    ...EU_LANGUAGE_CODES,
    ...NORDIC_LANGUAGE_CODES,
    'ru',
    'uk',
    'sr',
    'bs',
    'sq',
    'mk',
    'be',
    'cy',
    'ka',
    'hy',
    'az',
    ...ASIA_LANGUAGE_CODES,
    ...MIDDLE_EAST_LANGUAGE_CODES,
    ...AFRICA_LANGUAGE_CODES,
    ...LATIN_AMERICA_LANGUAGE_CODES,
  ]),
).filter((code) => code !== 'en');

/**
 * Complete discover language universe ('en' + all curated non-English codes).
 * Used when the user excludes specific languages or regions without specifying
 * a narrower positive language set, so TMDB's `with_original_language` receives
 * the exact complement server-side.
 */
export const ALL_DISCOVER_LANGUAGE_CODES = ['en', ...NON_ENGLISH_CODES];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the flat array of ISO 639-1 codes for a given region preset id. */
export function codesForPreset(presetId) {
  const preset = REGION_PRESETS.find((p) => p.id === presetId);
  return preset ? preset.codes : [];
}

/** Returns the preset object by id (region or special). */
export function findPreset(presetId) {
  return (
    REGION_PRESETS.find((p) => p.id === presetId) ||
    SPECIAL_PRESETS.find((p) => p.id === presetId) ||
    null
  );
}

/**
 * Translates an active preset selection into the `languageCodes` array
 * and `excludeEnglish` flag that discoverTitles() understands.
 *
 * Returns: { languageCodes: string[], excludeEnglish: boolean }
 */
export function resolvePreset(presetId) {
  if (!presetId) return { languageCodes: [], excludeEnglish: false };

  if (presetId === 'exclude_english' || presetId === 'non_english_only') {
    return { languageCodes: [], excludeEnglish: true };
  }

  const codes = codesForPreset(presetId);
  return { languageCodes: codes, excludeEnglish: false };
}
