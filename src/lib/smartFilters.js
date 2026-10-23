// ─── Smart Filters & Quick Picks Engine ───────────────────────────────────────
// Single source of truth for curated Discover Quick Picks and Smart Filters:
//  - Regional & special language filters (Non-English, European Union,
//    Middle East, Asian, African, Nordic, Latin America, plus legacy keys)
//  - Format, source & vibe filters (Airing this week, Miniseries, Under 100m,
//    Anime, Based on a Book, True Story, Stand-Up, Hidden Gems)
//
// Every filter supports the unified two-gesture tri-state grammar:
//   TAP  → Include (neutral ↔ include, clears exclude)
//   HOLD → Exclude (any state → exclude, exclude → neutral)

import {
  EU_LANGUAGE_CODES,
  MIDDLE_EAST_LANGUAGE_CODES,
  ASIA_LANGUAGE_CODES,
  AFRICA_LANGUAGE_CODES,
  NORDIC_LANGUAGE_CODES,
  LATIN_AMERICA_LANGUAGE_CODES,
  NON_ENGLISH_CODES,
  ALL_DISCOVER_LANGUAGE_CODES,
} from './languagePresets.js';
import {
  EU_COUNTRY_CODES,
  NORDIC_COUNTRY_CODES,
  LATIN_AMERICA_COUNTRY_CODES,
  codesForCountryPreset,
} from './countryPresets.js';
import {
  effectiveDiscoverSortBy,
  getAiringWindow,
  formatLocalYmd,
} from './tvAiringFilter.js';

export const ANIMATION_GENRE_ID = 16;
export const ANIME_KEYWORD_ID = '210024';
export const BASED_ON_BOOK_KEYWORD_ID = '818';
export const TRUE_STORY_KEYWORD_ID = '9672';
export const STAND_UP_KEYWORD_ID = '9716';

export const DEFAULT_DISCOVER_MIN_VOTES = 20;
export const AFRICA_DISCOVER_MIN_VOTES = 5;
export const HIDDEN_GEMS_MIN_VOTES = 50;
export const HIDDEN_GEMS_MAX_VOTES = 500;
export const HIDDEN_GEMS_MIN_RATING = 7.5;

/**
 * @typedef {Object} SmartFilter
 * @property {string} key
 * @property {string} label
 * @property {string} [icon]
 * @property {'region'|'vibe'|'legacy'} [category]
 * @property {'language'|'special_language'|'keyword'|'tv_type'|'runtime'|'votes'} kind
 * @property {('movie'|'tv')[]} [mediaTypes]
 * @property {string[]} [languageCodes]
 * @property {string[]} [originCountries]
 * @property {string} [countryPresetId]
 * @property {string} [keywordId]
 * @property {string} [includeTvType]
 * @property {string} [excludeTvType]
 * @property {{ min?: number, max?: number }} [includeRuntime]
 * @property {{ min?: number, max?: number }} [excludeRuntime]
 * @property {{ minRating?: number, minVotes?: number, maxVotes?: number }} [includeVotes]
 * @property {{ minVotes?: number, maxVotes?: number }} [excludeVotes]
 * @property {number} [minVoteCount]
 * @property {string} includeDescription
 * @property {string} excludeDescription
 */

/** @type {SmartFilter[]} */
export const SMART_FILTERS = [
  // ── Regional & Special Language Quick Picks ─────────────────────────────────
  {
    key: 'non_english',
    label: 'Non-English',
    icon: 'earth-outline',
    category: 'region',
    kind: 'special_language',
    includeDescription: 'Shows only titles whose original language is not English.',
    excludeDescription: 'Excludes non-English titles (shows English-language titles only).',
  },
  {
    key: 'eu',
    label: 'European Union',
    icon: 'flag-outline',
    category: 'region',
    kind: 'language',
    languageCodes: EU_LANGUAGE_CODES,
    originCountries: EU_COUNTRY_CODES,
    countryPresetId: 'eu',
    includeDescription:
      'Shows non-English titles in the official languages of the 27 European Union member states.',
    excludeDescription:
      'Removes titles in European Union member-state languages and origin countries.',
  },
  {
    key: 'middle_east',
    label: 'Middle East',
    icon: 'sunny-outline',
    category: 'region',
    kind: 'language',
    languageCodes: MIDDLE_EAST_LANGUAGE_CODES,
    countryPresetId: 'middle_east',
    includeDescription:
      'Shows titles in Middle Eastern languages (Arabic, Persian/Farsi, Turkish, Hebrew, Kurdish).',
    excludeDescription:
      'Removes titles in Middle Eastern languages (Arabic, Persian/Farsi, Turkish, Hebrew, Kurdish).',
  },
  {
    key: 'asia',
    label: 'Asian',
    icon: 'globe-outline',
    category: 'region',
    kind: 'language',
    languageCodes: ASIA_LANGUAGE_CODES,
    countryPresetId: 'asia',
    includeDescription:
      'Shows titles in East, South, Southeast, and Central Asian languages (Korean, Japanese, Mandarin, Cantonese, Hindi, Tamil, Telugu, Thai, Indonesian, Tagalog, and more).',
    excludeDescription: 'Removes titles in Asian languages.',
  },
  {
    key: 'africa',
    label: 'African',
    icon: 'leaf-outline',
    category: 'region',
    kind: 'language',
    languageCodes: AFRICA_LANGUAGE_CODES,
    countryPresetId: 'africa',
    minVoteCount: AFRICA_DISCOVER_MIN_VOTES,
    includeDescription:
      'Shows titles in African languages (Afrikaans, Swahili, Amharic, Wolof, Yoruba, Igbo, Hausa, Zulu, Xhosa, Sotho, Tswana, and more).',
    excludeDescription: 'Removes titles in African languages.',
  },
  {
    key: 'nordic',
    label: 'Nordic',
    icon: 'snow-outline',
    category: 'region',
    kind: 'language',
    languageCodes: NORDIC_LANGUAGE_CODES,
    originCountries: NORDIC_COUNTRY_CODES,
    countryPresetId: 'nordic',
    includeDescription:
      'Shows Nordic & Scandinavian titles (Danish, Swedish, Norwegian, Finnish, Icelandic).',
    excludeDescription: 'Removes Nordic & Scandinavian language titles.',
  },
  {
    key: 'latin_america',
    label: 'Latin America',
    icon: 'location-outline',
    category: 'region',
    kind: 'language',
    languageCodes: LATIN_AMERICA_LANGUAGE_CODES,
    originCountries: LATIN_AMERICA_COUNTRY_CODES,
    countryPresetId: 'latin_america',
    includeDescription:
      'Shows Spanish and Portuguese-language titles from Latin American countries.',
    excludeDescription: 'Removes Latin American titles.',
  },

  // ── Format, Vibe & Source Quick Picks ───────────────────────────────────────
  {
    key: 'miniseries',
    label: 'Miniseries',
    icon: 'layers-outline',
    category: 'vibe',
    kind: 'tv_type',
    mediaTypes: ['tv'],
    includeTvType: '2',
    excludeTvType: '0|4',
    includeDescription: 'Shows only limited series / miniseries.',
    excludeDescription: 'Excludes miniseries (shows ongoing / multi-season series only).',
  },
  {
    key: 'under_100m',
    label: 'Under 100m',
    icon: 'time-outline',
    category: 'vibe',
    kind: 'runtime',
    mediaTypes: ['movie'],
    includeRuntime: { min: 60, max: 100 },
    excludeRuntime: { min: 101 },
    includeDescription: 'Shows feature movies between 60 and 100 minutes.',
    excludeDescription: 'Excludes movies under 100 minutes (shows 101+ minute features).',
  },
  {
    key: 'anime',
    label: 'Anime',
    icon: 'sparkles-outline',
    category: 'vibe',
    kind: 'keyword',
    keywordId: ANIME_KEYWORD_ID,
    includeDescription: 'Shows only titles carrying the TMDB "anime" keyword.',
    excludeDescription:
      'Removes titles with the "anime" keyword or Japanese-language Animation.',
  },
  {
    key: 'based_on_book',
    label: 'Based on a Book',
    icon: 'book-outline',
    category: 'vibe',
    kind: 'keyword',
    keywordId: BASED_ON_BOOK_KEYWORD_ID,
    includeDescription: 'Shows adaptations based on novels or books.',
    excludeDescription: 'Excludes book adaptations.',
  },
  {
    key: 'true_story',
    label: 'True Story',
    icon: 'newspaper-outline',
    category: 'vibe',
    kind: 'keyword',
    keywordId: TRUE_STORY_KEYWORD_ID,
    includeDescription: 'Shows titles based on a true story or real events.',
    excludeDescription: 'Excludes titles based on a true story.',
  },
  {
    key: 'stand_up',
    label: 'Stand-Up',
    icon: 'mic-outline',
    category: 'vibe',
    kind: 'keyword',
    keywordId: STAND_UP_KEYWORD_ID,
    includeDescription: 'Shows stand-up comedy specials.',
    excludeDescription: 'Excludes stand-up comedy specials.',
  },
  {
    key: 'hidden_gems',
    label: 'Hidden Gems',
    icon: 'diamond-outline',
    category: 'vibe',
    kind: 'votes',
    includeVotes: {
      minRating: HIDDEN_GEMS_MIN_RATING,
      minVotes: HIDDEN_GEMS_MIN_VOTES,
      maxVotes: HIDDEN_GEMS_MAX_VOTES,
    },
    excludeVotes: {
      minVotes: HIDDEN_GEMS_MAX_VOTES,
    },
    includeDescription: 'Shows acclaimed, lesser-known titles (7.5+ rating, 50–500 votes).',
    excludeDescription: 'Excludes lesser-known titles (requires 500+ votes).',
  },

  // ── Legacy Individual-Language Smart Filter Keys (backward-compatible) ──────
  {
    key: 'korean',
    label: 'Korean',
    category: 'legacy',
    kind: 'language',
    languageCodes: ['ko'],
    includeDescription: 'Shows only titles with Korean as the original language.',
    excludeDescription: 'Removes titles with Korean as the original language.',
  },
  {
    key: 'japanese',
    label: 'Japanese',
    category: 'legacy',
    kind: 'language',
    languageCodes: ['ja'],
    includeDescription: 'Shows only titles with Japanese as the original language.',
    excludeDescription: 'Removes titles with Japanese as the original language.',
  },
  {
    key: 'chinese',
    label: 'Chinese',
    category: 'legacy',
    kind: 'language',
    languageCodes: ['zh', 'cn'],
    includeDescription: 'Shows only Chinese-language titles (Mandarin and Cantonese).',
    excludeDescription: 'Removes Chinese-language titles (Mandarin and Cantonese).',
  },
  {
    key: 'bollywood',
    label: 'Bollywood',
    category: 'legacy',
    kind: 'language',
    languageCodes: ['hi'],
    includeDescription: 'Shows only Hindi-language titles (Bollywood).',
    excludeDescription: 'Removes Hindi-language titles (Bollywood).',
  },
];

export const SMART_FILTER_KEYS = SMART_FILTERS.map((f) => f.key);
export const REGION_QUICK_PICK_FILTERS = SMART_FILTERS.filter((f) => f.category === 'region');
export const VIBE_QUICK_PICK_FILTERS = SMART_FILTERS.filter((f) => f.category === 'vibe');

const BY_KEY = new Map(SMART_FILTERS.map((f) => [f.key, f]));

/** @param {string} key @returns {SmartFilter | null} */
export function getSmartFilter(key) {
  return BY_KEY.get(key) || null;
}

/**
 * Filter keys that only apply to a specific mediaType ('movie' or 'tv').
 * Used when switching mediaType so universal filters survive while media-specific
 * ones (e.g. 'under_100m' on movie, 'miniseries' on tv) reset cleanly.
 * @param {string} key
 * @param {'movie'|'tv'} mediaType
 * @returns {boolean}
 */
export function isSmartFilterApplicableToMediaType(key, mediaType) {
  const filter = BY_KEY.get(key);
  if (!filter || !Array.isArray(filter.mediaTypes) || filter.mediaTypes.length === 0) {
    return true;
  }
  return filter.mediaTypes.includes(mediaType);
}

/**
 * Union of ISO 639-1 codes for every included language-kind smart filter.
 * @param {string[]} includeKeys
 * @returns {string[]}
 */
export function smartFilterLanguageCodes(includeKeys = []) {
  const codes = new Set();
  for (const key of includeKeys) {
    const filter = BY_KEY.get(key);
    if (filter?.kind === 'language') {
      (filter.languageCodes || []).forEach((code) => codes.add(code));
    }
  }
  return [...codes];
}

/**
 * TMDB keyword ids for every included keyword-kind smart filter.
 * @param {string[]} includeKeys
 * @returns {string[]}
 */
export function smartFilterKeywordIds(includeKeys = []) {
  const ids = [];
  for (const key of includeKeys) {
    const filter = BY_KEY.get(key);
    if (filter?.kind === 'keyword' && filter.keywordId) ids.push(filter.keywordId);
  }
  return ids;
}

/**
 * TMDB keyword ids for every excluded keyword-kind smart filter (maps to native
 * `without_keywords` on TMDB /discover).
 * @param {string[]} excludeKeys
 * @returns {string[]}
 */
export function smartFilterExcludeKeywordIds(excludeKeys = []) {
  const ids = [];
  for (const key of excludeKeys) {
    const filter = BY_KEY.get(key);
    if (filter?.kind === 'keyword' && filter.keywordId) ids.push(filter.keywordId);
  }
  return ids;
}

/**
 * Resolve the effective `with_original_language` code list and post-fetch
 * `excludedLanguageCodes` set from all active language & smart-filter controls.
 *
 * Set algebra rules:
 *  - Individual `languageCodes` and included regional language filters union into
 *    `explicitIncludeSet`.
 *  - `non_english` (included) or `excludeEnglish: true` adds `'en'` to `excludedSet`
 *    and marks `wantsNonEnglish = true`.
 *  - `non_english` (excluded) adds all `NON_ENGLISH_CODES` to `excludedSet` (leaving `'en'`).
 *  - Individual `excludeLanguageCodes` and excluded regional filters add their
 *    codes to `excludedSet` (with protection when `latin_america` and `eu` are
 *    combined in opposite directions so shared `es`/`pt` codes stay scoped by
 *    origin country rather than emptying the language list).
 *  - If `explicitIncludeSet` is non-empty, `withOriginalLanguage = explicitIncludeSet \ excludedSet`.
 *  - Otherwise, if `wantsNonEnglish` or `excludedSet` is non-empty,
 *    `withOriginalLanguage = ALL_DISCOVER_LANGUAGE_CODES \ excludedSet`.
 *
 * @param {Object} args
 * @param {string[]} [args.languageCodes]
 * @param {string[]} [args.excludeLanguageCodes]
 * @param {string[]} [args.includeSmartTags]
 * @param {string[]} [args.excludeSmartTags]
 * @param {boolean} [args.excludeEnglish]
 * @returns {{ withOriginalLanguage: string[], excludedLanguageCodes: string[] }}
 */
export function resolveEffectiveLanguageFilter({
  languageCodes = [],
  excludeLanguageCodes = [],
  includeSmartTags = [],
  excludeSmartTags = [],
  excludeEnglish = false,
} = {}) {
  const incTags = Array.isArray(includeSmartTags) ? includeSmartTags : [];
  const excTags = Array.isArray(excludeSmartTags) ? excludeSmartTags : [];
  const incLangs = (Array.isArray(languageCodes) ? languageCodes : []).filter(Boolean);
  const excLangs = (Array.isArray(excludeLanguageCodes) ? excludeLanguageCodes : []).filter(
    Boolean,
  );

  const wantsNonEnglish = Boolean(excludeEnglish) || incTags.includes('non_english');
  const excludesNonEnglish = excTags.includes('non_english');

  // 1. Collect explicit positive language codes
  const explicitIncludeSet = new Set(incLangs);
  for (const key of incTags) {
    const filter = BY_KEY.get(key);
    if (filter?.kind === 'language') {
      for (const code of filter.languageCodes || []) {
        explicitIncludeSet.add(code);
      }
    }
  }

  // 2. Collect excluded language codes
  const excludedSet = new Set(excLangs);
  if (wantsNonEnglish) {
    excludedSet.add('en');
  }
  if (excludesNonEnglish) {
    for (const code of NON_ENGLISH_CODES) {
      excludedSet.add(code);
    }
  }

  const hasEuIncluded = incTags.includes('eu');
  const hasLatamIncluded = incTags.includes('latin_america');

  for (const key of excTags) {
    const filter = BY_KEY.get(key);
    if (filter?.kind === 'language') {
      for (const code of filter.languageCodes || []) {
        // When EU is included and Latin America is excluded (or vice-versa),
        // 'es' and 'pt' are shared between Spain/Portugal and Latin America;
        // origin_country already separates them, so don't wipe 'es'/'pt' unless
        // the user explicitly excluded 'es'/'pt' in excludeLanguageCodes.
        if (
          (key === 'latin_america' && hasEuIncluded && (code === 'es' || code === 'pt')) ||
          (key === 'eu' && hasLatamIncluded && (code === 'es' || code === 'pt'))
        ) {
          if (!excLangs.includes(code)) continue;
        }
        // Similarly, if the user explicitly picked a single language in `languageCodes`
        // (e.g. tapped French) while excluding a broad region, keep the explicit pick.
        if (incLangs.includes(code) && !excLangs.includes(code)) continue;
        excludedSet.add(code);
      }
    }
  }

  // 3. Compute effective `with_original_language` list
  if (explicitIncludeSet.size > 0) {
    const withOriginalLanguage = [...explicitIncludeSet].filter((code) => !excludedSet.has(code));
    return {
      withOriginalLanguage,
      excludedLanguageCodes: [...excludedSet],
    };
  }

  if (wantsNonEnglish || excludedSet.size > 0) {
    const withOriginalLanguage = ALL_DISCOVER_LANGUAGE_CODES.filter(
      (code) => !excludedSet.has(code),
    );
    return {
      withOriginalLanguage,
      excludedLanguageCodes: [...excludedSet],
    };
  }

  return {
    withOriginalLanguage: [],
    excludedLanguageCodes: [],
  };
}

/**
 * Resolve effective `with_origin_country` ISO 3166-1 codes from manual picks
 * and regional smart filters (such as European Union and Latin America).
 *
 * When a regional filter with `originCountries` (like `eu` or `latin_america`)
 * is included, its country codes scope `with_origin_country`. If combined with
 * another included regional filter (e.g. `asia` or `middle_east`), that region's
 * country preset codes are unioned so cross-region combinations don't drop
 * non-EU countries.
 *
 * @param {Object} args
 * @param {string[]} [args.originCountries]
 * @param {string[]} [args.excludeOriginCountries]
 * @param {string[]} [args.includeSmartTags]
 * @param {string[]} [args.excludeSmartTags]
 * @param {string[]} [args.languageCodes]
 * @param {'movie'|'tv'} [args.mediaType]
 * @param {string|null} [args.activeCountryPreset]
 * @returns {{ withOriginCountries: string[], excludedOriginCountries: string[] }}
 */
export function resolveEffectiveOriginCountries({
  originCountries = [],
  excludeOriginCountries = [],
  includeSmartTags = [],
  excludeSmartTags = [],
  languageCodes = [],
  mediaType = 'movie',
  activeCountryPreset = null,
} = {}) {
  const manualCountries = (Array.isArray(originCountries) ? originCountries : []).filter(Boolean);
  const manualExcluded = new Set(
    (Array.isArray(excludeOriginCountries) ? excludeOriginCountries : []).filter(Boolean),
  );
  const incTags = Array.isArray(includeSmartTags) ? includeSmartTags : [];
  const excTags = Array.isArray(excludeSmartTags) ? excludeSmartTags : [];

  for (const key of excTags) {
    const filter = BY_KEY.get(key);
    if (filter?.originCountries) {
      for (const code of filter.originCountries) manualExcluded.add(code);
    }
  }

  // Check if any included smart filter carries an origin-country scope (e.g. 'eu', 'latin_america')
  const regionFilters = incTags
    .map((key) => BY_KEY.get(key))
    .filter((f) => f && f.kind === 'language');
  const hasCountryScopedFilter = regionFilters.some(
    (f) => Array.isArray(f.originCountries) && f.originCountries.length > 0,
  );

  const countrySet = new Set(manualCountries);

  if (manualCountries.length === 0 && mediaType === 'tv' && activeCountryPreset) {
    for (const c of codesForCountryPreset(activeCountryPreset)) {
      countrySet.add(c);
    }
  }

  if (hasCountryScopedFilter && languageCodes.length === 0) {
    for (const f of regionFilters) {
      if (Array.isArray(f.originCountries) && f.originCountries.length > 0) {
        for (const c of f.originCountries) countrySet.add(c);
      } else if (f.countryPresetId) {
        for (const c of codesForCountryPreset(f.countryPresetId)) countrySet.add(c);
      }
    }
  }

  const withOriginCountries = [...countrySet].filter((c) => !manualExcluded.has(c));
  return {
    withOriginCountries,
    excludedOriginCountries: [...manualExcluded],
  };
}

/**
 * Shared Anime predicate. Used by the exclude path (and by anything else that
 * needs "is this an anime?" over a raw discover item).
 * @param {any} rawItem  raw TMDB discover result
 * @returns {boolean}
 */
export function isAnimeItem(rawItem = {}) {
  const lang = (rawItem.original_language || '').toLowerCase();
  const genreIds = rawItem.genre_ids || [];
  return lang === 'ja' && genreIds.includes(ANIMATION_GENRE_ID);
}

/**
 * True when a raw TMDB item should be dropped given the set of excluded smart
 * filter keys and excluded language/country codes.
 * @param {any} rawItem
 * @param {string[]} excludeKeys
 * @param {{ excludedLanguageCodes?: string[], excludedOriginCountries?: string[] }} [extra]
 * @returns {boolean}
 */
export function isExcludedBySmartFilters(rawItem = {}, excludeKeys = [], extra = {}) {
  const lang = (rawItem.original_language || '').toLowerCase();
  const itemCountries = Array.isArray(rawItem.origin_country) ? rawItem.origin_country : [];

  if (
    Array.isArray(extra.excludedLanguageCodes) &&
    extra.excludedLanguageCodes.length > 0 &&
    lang &&
    extra.excludedLanguageCodes.includes(lang)
  ) {
    return true;
  }

  if (
    Array.isArray(extra.excludedOriginCountries) &&
    extra.excludedOriginCountries.length > 0 &&
    itemCountries.length > 0 &&
    itemCountries.every((c) => extra.excludedOriginCountries.includes(c))
  ) {
    return true;
  }

  for (const key of excludeKeys) {
    const filter = BY_KEY.get(key);
    if (!filter) continue;
    if (filter.kind === 'keyword' && filter.key === 'anime') {
      if (isAnimeItem(rawItem)) return true;
    } else if (filter.kind === 'special_language' && filter.key === 'non_english') {
      if (lang && lang !== 'en') return true;
    } else if (filter.kind === 'language') {
      if ((filter.languageCodes || []).includes(lang)) return true;
    }
  }
  return false;
}

/**
 * Pure query-parameter builder for TMDB's `/discover/movie` and `/discover/tv`.
 *
 * Notice that `vote_count.gte` is completely invariant across `sortBy` options:
 * changing Sort (`popularity.desc`, `vote_average.desc`, `primary_release_date.desc`,
 * `revenue.desc`, etc.) only reorders the candidate set and never alters the
 * filter predicates or the resulting match count.
 *
 * @param {Object} filters
 * @param {Date} [now]
 * @returns {{
 *   params: Record<string, any>,
 *   excludedLanguageCodes: string[],
 *   excludedOriginCountries: string[],
 *   excludeKeys: string[]
 * }}
 */
export function buildDiscoverQueryParams(filters = {}, now = new Date()) {
  const {
    mediaType = 'movie',
    genreIds = [],
    genreLogic = 'AND',
    excludeGenreIds = [],
    excludeSmartTags = [],
    includeSmartTags = [],
    minRating = null,
    maxRating = null,
    languageCodes = [],
    excludeLanguageCodes = [],
    originCountries = [],
    excludeOriginCountries = [],
    fromYear = null,
    toYear = null,
    minRuntime = null,
    maxRuntime = null,
    sortBy = 'popularity.desc',
    excludeEnglish = false,
    airingThisWeek = false,
    excludeAiringThisWeek = false,
    activeCountryPreset = null,
    watchRegion = null,
    watchProviders = [],
    minVoteCount = null,
    page = 1,
  } = filters;

  const incTags = Array.isArray(includeSmartTags) ? includeSmartTags : [];
  const excTags = Array.isArray(excludeSmartTags) ? excludeSmartTags : [];

  // Vote floor depends ONLY on filter criteria (or explicit minVoteCount), never on sortBy.
  let voteCountFloor = DEFAULT_DISCOVER_MIN_VOTES;
  let voteCountCeiling = null;

  if (minVoteCount != null && Number.isFinite(Number(minVoteCount))) {
    voteCountFloor = Number(minVoteCount);
  } else if (excTags.includes('hidden_gems')) {
    voteCountFloor = HIDDEN_GEMS_MAX_VOTES;
  } else if (incTags.includes('hidden_gems')) {
    voteCountFloor = HIDDEN_GEMS_MIN_VOTES;
    voteCountCeiling = HIDDEN_GEMS_MAX_VOTES;
  } else if (incTags.includes('africa')) {
    voteCountFloor = AFRICA_DISCOVER_MIN_VOTES;
  }

  const params = {
    sort_by: effectiveDiscoverSortBy(sortBy, mediaType),
    'vote_count.gte': voteCountFloor,
    include_adult: false,
    page,
  };

  if (voteCountCeiling != null) {
    params['vote_count.lte'] = voteCountCeiling;
  }

  if (watchRegion && watchProviders.length > 0) {
    params.watch_region = watchRegion;
    params.with_watch_providers = watchProviders.join('|');
    params.with_watch_monetization_types = 'flatrate|free|ads';
  }

  // ── Include genres ──────────────────────────────────────────────────────────
  if (genreIds.length > 0) {
    const separator = genreLogic === 'OR' ? '|' : ',';
    params.with_genres = genreIds.join(separator);
  }

  // ── Exclude genres (TMDB native support) ───────────────────────────────────
  if (excludeGenreIds.length > 0) {
    params.without_genres = excludeGenreIds.join(',');
  }

  // ── Include / Exclude keyword smart filters ─────────────────────────────────
  const keywordIds = smartFilterKeywordIds(incTags);
  if (keywordIds.length > 0) {
    params.with_keywords = keywordIds.join('|');
  }

  const excludeKeywordIds = smartFilterExcludeKeywordIds(excTags);
  if (excludeKeywordIds.length > 0) {
    params.without_keywords = excludeKeywordIds.join(',');
  }

  // ── Rating bounds ───────────────────────────────────────────────────────────
  const numericMinRating = minRating != null && minRating !== '' ? Number(minRating) : null;
  const effectiveMinRating = incTags.includes('hidden_gems')
    ? Math.max(numericMinRating || 0, HIDDEN_GEMS_MIN_RATING)
    : numericMinRating;

  if (effectiveMinRating != null && effectiveMinRating > 0) {
    params['vote_average.gte'] = effectiveMinRating;
  }

  if (maxRating != null && maxRating > 0) {
    params['vote_average.lte'] = maxRating;
  }

  // ── Language set algebra (native with_original_language) ────────────────────
  const { withOriginalLanguage, excludedLanguageCodes } = resolveEffectiveLanguageFilter({
    languageCodes,
    excludeLanguageCodes,
    includeSmartTags: incTags,
    excludeSmartTags: excTags,
    excludeEnglish,
  });

  if (withOriginalLanguage.length > 0) {
    params.with_original_language = withOriginalLanguage.join('|');
  }

  // ── Origin country resolution (native with_origin_country) ──────────────────
  const { withOriginCountries, excludedOriginCountries } = resolveEffectiveOriginCountries({
    originCountries,
    excludeOriginCountries,
    includeSmartTags: incTags,
    excludeSmartTags: excTags,
    languageCodes,
    mediaType,
    activeCountryPreset,
  });

  if (withOriginCountries.length > 0) {
    params.with_origin_country = withOriginCountries.join('|');
  }

  // ── Media-type specific filters ─────────────────────────────────────────────
  if (mediaType === 'movie') {
    if (fromYear) params['primary_release_date.gte'] = `${fromYear}-01-01`;
    if (toYear) params['primary_release_date.lte'] = `${toYear}-12-31`;

    const parsedMinRt = parseInt(minRuntime, 10);
    const parsedMaxRt = parseInt(maxRuntime, 10);
    const manualMinRt = minRuntime && !isNaN(parsedMinRt) && parsedMinRt > 0 ? parsedMinRt : 0;
    const manualMaxRt = maxRuntime && !isNaN(parsedMaxRt) && parsedMaxRt > 0 ? parsedMaxRt : 0;

    let effectiveMinRt = manualMinRt;
    let effectiveMaxRt = manualMaxRt;

    if (incTags.includes('under_100m')) {
      effectiveMinRt = Math.max(effectiveMinRt, 60);
      effectiveMaxRt = effectiveMaxRt > 0 ? Math.min(effectiveMaxRt, 100) : 100;
    } else if (excTags.includes('under_100m')) {
      effectiveMinRt = Math.max(effectiveMinRt, 101);
    }

    if (effectiveMinRt > 0) {
      params['with_runtime.gte'] = effectiveMinRt;
    } else if (effectiveMaxRt > 0) {
      params['with_runtime.gte'] = 1;
    }
    if (effectiveMaxRt > 0) {
      params['with_runtime.lte'] = effectiveMaxRt;
    }
  } else {
    if (fromYear) params['first_air_date.gte'] = `${fromYear}-01-01`;
    if (toYear) params['first_air_date.lte'] = `${toYear}-12-31`;

    if (airingThisWeek) {
      const { start, end } = getAiringWindow(now);
      params['air_date.gte'] = formatLocalYmd(start);
      params['air_date.lte'] = formatLocalYmd(end);
    } else if (excludeAiringThisWeek) {
      // Ended series only (excludes returning/ongoing shows).
      params.with_status = '3';
    }

    if (incTags.includes('miniseries')) {
      params.with_type = '2';
    } else if (excTags.includes('miniseries')) {
      params.with_type = '0|4';
    }
  }

  const excludeKeys = excTags.filter((key) => SMART_FILTER_KEYS.includes(key));

  return {
    params,
    excludedLanguageCodes,
    excludedOriginCountries,
    excludeKeys,
  };
}
