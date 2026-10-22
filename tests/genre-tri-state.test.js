import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENRE_STATE,
  genreStateFor,
  smartTagStateFor,
  languageStateFor,
  airingStateFor,
  reduceTriState,
} from '../src/lib/genreTriState.js';
import { translateSortByForMediaType, effectiveDiscoverSortBy } from '../src/lib/tvAiringFilter.js';

const { NEUTRAL, INCLUDE, EXCLUDE } = GENRE_STATE;

// ─── genreStateFor ─────────────────────────────────────────────────────────────

test('genreStateFor reads include / exclude / neutral off the filters', () => {
  const filters = { genreIds: [28, 12], excludeGenreIds: [27] };
  assert.equal(genreStateFor(28, filters), INCLUDE);
  assert.equal(genreStateFor(27, filters), EXCLUDE);
  assert.equal(genreStateFor(99, filters), NEUTRAL);
});

test('genreStateFor tolerates missing / undefined filter arrays', () => {
  assert.equal(genreStateFor(1, {}), NEUTRAL);
  assert.equal(genreStateFor(1, undefined), NEUTRAL);
  assert.equal(genreStateFor(1, { genreIds: undefined, excludeGenreIds: undefined }), NEUTRAL);
});

test('smartTagStateFor reads include / exclude / neutral off the filters', () => {
  const filters = { includeSmartTags: ['anime', 'eu'], excludeSmartTags: ['korean', 'middle_east'] };
  assert.equal(smartTagStateFor('anime', filters), INCLUDE);
  assert.equal(smartTagStateFor('eu', filters), INCLUDE);
  assert.equal(smartTagStateFor('korean', filters), EXCLUDE);
  assert.equal(smartTagStateFor('middle_east', filters), EXCLUDE);
  assert.equal(smartTagStateFor('chinese', filters), NEUTRAL);
});

test('languageStateFor reads include / exclude / neutral for individual Quick Pick languages', () => {
  const filters = { languageCodes: ['fr', 'da'], excludeLanguageCodes: ['en'] };
  assert.equal(languageStateFor('fr', filters), INCLUDE);
  assert.equal(languageStateFor('da', filters), INCLUDE);
  assert.equal(languageStateFor('en', filters), EXCLUDE);
  assert.equal(languageStateFor('de', filters), NEUTRAL);
});

test('airingStateFor reads include / exclude / neutral for Airing this week', () => {
  assert.equal(airingStateFor({ mediaType: 'tv', airingThisWeek: true }), INCLUDE);
  assert.equal(airingStateFor({ mediaType: 'tv', excludeAiringThisWeek: true }), EXCLUDE);
  assert.equal(airingStateFor({ mediaType: 'movie', airingThisWeek: true }), NEUTRAL);
  assert.equal(airingStateFor({ mediaType: 'tv' }), NEUTRAL);
});

// ─── Sort translation across Movie/TV tabs ────────────────────────────────────

test('translateSortByForMediaType preserves Newest/Oldest across Movie and TV switches', () => {
  assert.equal(
    translateSortByForMediaType('primary_release_date.desc', 'tv'),
    'first_air_date.desc',
  );
  assert.equal(
    translateSortByForMediaType('primary_release_date.asc', 'tv'),
    'first_air_date.asc',
  );
  assert.equal(
    translateSortByForMediaType('first_air_date.desc', 'movie'),
    'primary_release_date.desc',
  );
  assert.equal(
    translateSortByForMediaType('first_air_date.asc', 'movie'),
    'primary_release_date.asc',
  );
  assert.equal(translateSortByForMediaType('revenue.desc', 'tv'), 'popularity.desc');
  assert.equal(effectiveDiscoverSortBy('primary_release_date.desc', 'tv'), 'first_air_date.desc');
});

// ─── reduceTriState: the whole 6-transition contract ───────────────────────────

test('TAP toggles "want it": neutral → include, include → neutral', () => {
  assert.equal(reduceTriState(NEUTRAL, 'tap'), INCLUDE);
  assert.equal(reduceTriState(INCLUDE, 'tap'), NEUTRAL);
});

test('TAP on an excluded chip clears it (exclude → neutral) — never flips to include', () => {
  assert.equal(reduceTriState(EXCLUDE, 'tap'), NEUTRAL);
});

test('HOLD reaches exclude in ONE gesture from any state (the core fix)', () => {
  // neutral → exclude directly, with no transient include of the rejected genre
  assert.equal(reduceTriState(NEUTRAL, 'hold'), EXCLUDE);
  // include → exclude directly
  assert.equal(reduceTriState(INCLUDE, 'hold'), EXCLUDE);
});

test('HOLD on an excluded chip clears it (exclude → neutral)', () => {
  assert.equal(reduceTriState(EXCLUDE, 'hold'), NEUTRAL);
});

test('excluding is never routed through include first', () => {
  let state = NEUTRAL;
  state = reduceTriState(state, 'hold');
  assert.equal(state, EXCLUDE);
});
