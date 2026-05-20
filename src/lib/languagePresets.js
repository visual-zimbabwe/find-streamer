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

// ─── Region Presets ───────────────────────────────────────────────────────────

export const REGION_PRESETS = [
  {
    id: 'europe',
    label: 'Europe 🌍',
    emoji: '🌍',
    description: 'French, Spanish, German, Italian, Portuguese, Russian, Polish, Dutch, Swedish, Norwegian, Danish, Finnish, Czech, Romanian, Greek, Hungarian, Ukrainian',
    // Note: Catalan (ca), Basque (eu), Galician (gl), Welsh (cy) omitted — minimal
    // TMDB coverage. Serbian/Croatian share content under 'hr'/'sr' but TMDB often
    // conflates them; including both for best coverage.
    codes: ['fr', 'es', 'de', 'it', 'pt', 'ru', 'pl', 'nl', 'sv', 'no', 'da', 'fi', 'cs', 'ro', 'el', 'hu', 'uk', 'hr', 'sr', 'sk', 'bg', 'lt', 'lv', 'et'],
    smartFilter: false,
  },
  {
    id: 'asia',
    label: 'Asia 🌏',
    emoji: '🌏',
    description: 'Korean, Japanese, Mandarin Chinese, Cantonese, Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Punjabi, Sinhala, Nepali, Urdu, Thai, Vietnamese, Indonesian, Malay, Tagalog/Filipino',
    // Combines East Asia, South Asia, and Southeast Asia.
    // Note: TMDB uses 'zh' for Mandarin and 'cn' is sometimes used for Cantonese.
    // Many Indian regional languages have sparse TMDB entries; the main
    // industry languages (hi, ta, te, ml, kn) have solid coverage.
    codes: ['ko', 'ja', 'zh', 'cn', 'hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa', 'si', 'ne', 'ur', 'th', 'vi', 'id', 'ms', 'tl'],
    smartFilter: true,
    smartFilterNote: 'TMDB uses \'zh\' broadly for Chinese content. Mandarin and Cantonese titles may be mixed. Results tagged with \'cn\' (Cantonese) are included for broader coverage.',
  },
  {
    id: 'middle_east',
    label: 'Middle East 🕌',
    emoji: '🕌',
    description: 'Arabic, Persian/Farsi, Turkish, Hebrew',
    // Note: Arabic ('ar') covers a broad dialectal space. TMDB's 'ar' maps to MSA
    // and is imperfect for regional dialect content (Egyptian, Levantine, Gulf).
    // Labeled as smart filter to signal this limitation.
    codes: ['ar', 'fa', 'tr', 'he'],
    smartFilter: true,
    smartFilterNote: 'Arabic content uses a broad regional code — results may include films from any Arabic-speaking country.',
  },
  {
    id: 'africa',
    label: 'Africa 🌍',
    emoji: '🌍',
    description: 'Afrikaans, Swahili, Amharic, Somali, Wolof, Yoruba, Igbo, Hausa, Zulu, Xhosa',
    // Note: Many Sub-Saharan African languages have very limited TMDB coverage.
    // This preset is a best-effort approximation and is marked as a smart filter.
    codes: ['af', 'sw', 'am', 'so', 'wo', 'yo', 'ig', 'ha', 'zu', 'xh'],
    smartFilter: true,
    smartFilterNote: 'African language content has limited TMDB coverage. Results may be sparse.',
  },
  {
    id: 'latin_america',
    label: 'Latin America 🌎',
    emoji: '🌎',
    description: 'Spanish (Latin American), Portuguese (Brazilian)',
    // Note: TMDB does not differentiate between Spanish variants (es covers both
    // Spain and Latin America). Use Origin Country filter for precision.
    codes: ['es', 'pt'],
    smartFilter: true,
    smartFilterNote: 'Spanish covers both Spain and Latin America. Use Origin Country (TV) for regional precision.',
  },
  {
    id: 'north_america',
    label: 'North America 🇺🇸',
    emoji: '🇺🇸',
    description: 'English, French (Canadian)',
    codes: ['en', 'fr'],
    smartFilter: false,
  },
];

// ─── Special Presets ──────────────────────────────────────────────────────────

/**
 * Special preset IDs that are not region groupings but semantic toggles.
 * The ViewModel handles these by manipulating excludeEnglish / nonEnglishOnly
 * flags rather than populating languageCodes.
 */
export const SPECIAL_PRESETS = [
  {
    id: 'exclude_english',
    label: 'Exclude English 🚫🇬🇧',
    emoji: '🚫',
    description: 'Show results from any language except English.',
    isSpecial: true,
  },
  {
    id: 'non_english_only',
    label: 'Non-English Only 🌐',
    emoji: '🌐',
    description: 'Equivalent to Exclude English — ensures all results have a non-English original language.',
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
  europe:        'europe',
  asia:          'asia',
  middle_east:   'middle_east',
  africa:        'africa',
  latin_america: 'latin_america',
  north_america: 'north_america',
};

// ─── Non-English Curated Language List ───────────────────────────────────────

/**
 * A curated, stable list of ISO 639-1 codes representing the major
 * non-English content-producing languages on TMDB.
 *
 * This is used by the "Exclude English" / "Non-English Only" presets
 * as a workaround for TMDB's lack of a native `without_original_language`
 * parameter. Using this curated list instead of fetching all ~180+ TMDB
 * language codes avoids URL-length issues (414 errors) and keeps the query
 * semantically meaningful.
 *
 * The list is the union of all codes across REGION_PRESETS, minus 'en'.
 */
export const NON_ENGLISH_CODES = [
  // Europe
  'fr', 'es', 'de', 'it', 'pt', 'ru', 'pl', 'nl', 'sv', 'no', 'da',
  'fi', 'cs', 'ro', 'el', 'hu', 'uk', 'hr', 'sr', 'sk', 'bg', 'lt', 'lv', 'et',
  // Asia
  'ko', 'ja', 'zh', 'cn', 'hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr',
  'pa', 'si', 'ne', 'ur', 'th', 'vi', 'id', 'ms', 'tl',
  // Middle East
  'ar', 'fa', 'tr', 'he',
  // Africa
  'af', 'sw', 'am', 'so', 'wo', 'yo', 'ig', 'ha', 'zu', 'xh',
];

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
