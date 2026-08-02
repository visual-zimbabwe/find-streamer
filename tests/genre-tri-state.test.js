import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GENRE_STATE,
  genreStateFor,
  smartTagStateFor,
  reduceTriState,
} from '../src/lib/genreTriState.js';

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
  const filters = { includeSmartTags: ['anime'], excludeSmartTags: ['korean'] };
  assert.equal(smartTagStateFor('anime', filters), INCLUDE);
  assert.equal(smartTagStateFor('korean', filters), EXCLUDE);
  assert.equal(smartTagStateFor('chinese', filters), NEUTRAL);
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
  // Regression guard for the old cycle: from neutral, one gesture must be able to
  // land on EXCLUDE without ever passing through INCLUDE.
  let state = NEUTRAL;
  state = reduceTriState(state, 'hold');
  assert.equal(state, EXCLUDE);
  // and it never became INCLUDE on the way
});
