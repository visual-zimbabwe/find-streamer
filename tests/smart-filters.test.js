import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SMART_FILTER_KEYS,
  smartFilterKeywordIds,
  smartFilterLanguageCodes,
  isAnimeItem,
  isExcludedBySmartFilters,
  ANIME_KEYWORD_ID,
} from '../src/lib/smartFilters.js';

// ─── Catalogue ─────────────────────────────────────────────────────────────────

test('the five curated smart filters are all present', () => {
  assert.deepEqual(
    [...SMART_FILTER_KEYS].sort(),
    ['anime', 'bollywood', 'chinese', 'japanese', 'korean'],
  );
});

// ─── Include: native keyword + language params ─────────────────────────────────

test('keyword-kind filters expose their keyword id; language-kind ones do not', () => {
  assert.deepEqual(smartFilterKeywordIds(['anime']), [ANIME_KEYWORD_ID]);
  assert.deepEqual(smartFilterKeywordIds(['korean']), []);
  assert.deepEqual(smartFilterKeywordIds(['korean', 'anime', 'japanese']), [ANIME_KEYWORD_ID]);
});

test('language-kind filters expose their ISO codes; anime contributes none', () => {
  assert.deepEqual(smartFilterLanguageCodes(['korean']), ['ko']);
  assert.deepEqual(smartFilterLanguageCodes(['japanese']), ['ja']);
  // Chinese spans Mandarin (zh) + Cantonese (cn).
  assert.deepEqual(smartFilterLanguageCodes(['chinese']), ['zh', 'cn']);
  assert.deepEqual(smartFilterLanguageCodes(['bollywood']), ['hi']);
  assert.deepEqual(smartFilterLanguageCodes(['anime']), []);
});

test('multiple included language filters union their codes without dupes', () => {
  const codes = smartFilterLanguageCodes(['korean', 'chinese', 'japanese']);
  assert.deepEqual([...codes].sort(), ['cn', 'ja', 'ko', 'zh']);
});

test('unknown keys are ignored on both include helpers', () => {
  assert.deepEqual(smartFilterLanguageCodes(['klingon']), []);
  assert.deepEqual(smartFilterKeywordIds(['klingon']), []);
});

// ─── Anime predicate (shared by include intent + exclude) ──────────────────────

test('isAnimeItem requires Japanese original language AND the Animation genre', () => {
  assert.equal(isAnimeItem({ original_language: 'ja', genre_ids: [16] }), true);
  assert.equal(isAnimeItem({ original_language: 'ja', genre_ids: [18] }), false);
  assert.equal(isAnimeItem({ original_language: 'en', genre_ids: [16] }), false);
});

test('isAnimeItem no longer trusts a bare "anime" text match (the old false-positive)', () => {
  // Live-action film that merely mentions anime in its overview must NOT count.
  assert.equal(
    isAnimeItem({ original_language: 'en', genre_ids: [18], overview: 'a love letter to anime' }),
    false,
  );
});

// ─── Exclude: post-fetch predicate, symmetric with include ─────────────────────

test('excluding a language filter drops items in that language', () => {
  assert.equal(isExcludedBySmartFilters({ original_language: 'ko' }, ['korean']), true);
  assert.equal(isExcludedBySmartFilters({ original_language: 'cn' }, ['chinese']), true);
  assert.equal(isExcludedBySmartFilters({ original_language: 'hi' }, ['bollywood']), true);
});

test('excluding one language does not drop another', () => {
  assert.equal(isExcludedBySmartFilters({ original_language: 'ko' }, ['japanese']), false);
  assert.equal(isExcludedBySmartFilters({ original_language: 'en' }, ['korean', 'chinese']), false);
});

test('excluding anime uses the same ja+Animation predicate the include intent carries', () => {
  assert.equal(isExcludedBySmartFilters({ original_language: 'ja', genre_ids: [16] }, ['anime']), true);
  assert.equal(isExcludedBySmartFilters({ original_language: 'ja', genre_ids: [10759] }, ['anime']), false);
});

test('no excluded keys means nothing is dropped', () => {
  assert.equal(isExcludedBySmartFilters({ original_language: 'ko' }, []), false);
});
