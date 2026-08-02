// ─── Smart Filters ────────────────────────────────────────────────────────────
// Curated Discover buckets that don't map 1:1 to a TMDB genre (Anime, Korean,
// Japanese, Chinese, Bollywood). This module is the SINGLE source of truth for
// both the UI (labels/descriptions in DiscoverScreen) and the query builder
// (discoverTitles in tmdb.js), so a filter's include path and exclude path can
// never drift into two different definitions again — the exact bug the old
// keyword-include-vs-heuristic-exclude "Anime" had.
//
// Two kinds:
//  - 'language': a bucket defined by original language. Include is native
//    (`with_original_language`, so counts/paging stay exact); exclude is a
//    post-fetch predicate on `original_language` (TMDB has no
//    `without_original_language`).
//  - 'keyword': a bucket defined by a TMDB keyword (Anime). Include is native
//    (`with_keywords`); exclude is a best-effort post-fetch predicate — discover
//    result payloads carry no keyword list, so the keyword-include can't be
//    mirrored byte-for-byte on exclude; the shared *intent* is `ja` + Animation.

export const ANIMATION_GENRE_ID = 16;
export const ANIME_KEYWORD_ID = '210024';

/**
 * @typedef {Object} SmartFilter
 * @property {string} key
 * @property {string} label
 * @property {'language'|'keyword'} kind
 * @property {string[]} [languageCodes]  ISO 639-1 codes for kind: 'language'
 * @property {string} [keywordId]        TMDB keyword id for kind: 'keyword'
 * @property {string} includeDescription
 * @property {string} excludeDescription
 */

/** @type {SmartFilter[]} */
export const SMART_FILTERS = [
  {
    key: 'anime',
    label: 'Anime',
    kind: 'keyword',
    keywordId: ANIME_KEYWORD_ID,
    includeDescription: 'Shows only titles carrying the TMDB "anime" keyword.',
    excludeDescription:
      'Removes titles whose original language is Japanese and which carry the Animation genre.',
  },
  {
    key: 'korean',
    label: 'Korean',
    kind: 'language',
    languageCodes: ['ko'],
    includeDescription: 'Shows only titles with Korean as the original language.',
    excludeDescription: 'Removes titles with Korean as the original language.',
  },
  {
    key: 'japanese',
    label: 'Japanese',
    kind: 'language',
    languageCodes: ['ja'],
    includeDescription: 'Shows only titles with Japanese as the original language.',
    excludeDescription: 'Removes titles with Japanese as the original language.',
  },
  {
    key: 'chinese',
    label: 'Chinese',
    kind: 'language',
    // Mandarin (zh) + Cantonese (cn) — TMDB splits Chinese across both codes.
    languageCodes: ['zh', 'cn'],
    includeDescription: 'Shows only Chinese-language titles (Mandarin and Cantonese).',
    excludeDescription: 'Removes Chinese-language titles (Mandarin and Cantonese).',
  },
  {
    key: 'bollywood',
    label: 'Bollywood',
    kind: 'language',
    // Bollywood = the Hindi-language Indian film industry. `hi` is the practical
    // proxy; origin-country precision is left to the Country control.
    languageCodes: ['hi'],
    includeDescription: 'Shows only Hindi-language titles (Bollywood).',
    excludeDescription: 'Removes Hindi-language titles (Bollywood).',
  },
];

export const SMART_FILTER_KEYS = SMART_FILTERS.map((f) => f.key);

const BY_KEY = new Map(SMART_FILTERS.map((f) => [f.key, f]));

/** @param {string} key @returns {SmartFilter | null} */
export function getSmartFilter(key) {
  return BY_KEY.get(key) || null;
}

/**
 * Union of ISO 639-1 codes for every included language-kind smart filter.
 * These get merged into `with_original_language` alongside the manual Language
 * picker so a Smart Filter and a picked language never clobber each other.
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
 * Shared Anime predicate. Used by the exclude path (and by anything else that
 * needs "is this an anime?" over a raw discover item). Deliberately narrow: the
 * `ja` + Animation core is the same intent the keyword-include carries. No
 * title/overview text match — that false-positived on live-action films that
 * merely mention anime.
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
 * filter keys. One predicate per kind, so every filter excludes the same thing
 * it would have included.
 * @param {any} rawItem
 * @param {string[]} excludeKeys
 * @returns {boolean}
 */
export function isExcludedBySmartFilters(rawItem = {}, excludeKeys = []) {
  const lang = (rawItem.original_language || '').toLowerCase();
  for (const key of excludeKeys) {
    const filter = BY_KEY.get(key);
    if (!filter) continue;
    if (filter.kind === 'keyword' && filter.key === 'anime') {
      if (isAnimeItem(rawItem)) return true;
    } else if (filter.kind === 'language') {
      if ((filter.languageCodes || []).includes(lang)) return true;
    }
  }
  return false;
}
