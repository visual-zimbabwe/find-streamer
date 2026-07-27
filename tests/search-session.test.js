import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_SEARCH_SESSION,
  SEARCH_PHASE,
  searchSessionReducer,
} from '../src/lib/searchSession.js';

test("a new submit removes the previous query's results before its request returns", () => {
  const previous = {
    phase: SEARCH_PHASE.RESULTS,
    submittedQuery: 'Alien',
    results: [{ title: 'Alien' }],
    error: null,
  };

  const next = searchSessionReducer(previous, { type: 'SUBMIT', query: 'Arrival' });

  assert.equal(next.phase, SEARCH_PHASE.LOADING);
  assert.equal(next.submittedQuery, 'Arrival');
  assert.deepEqual(next.results, []);
});

test('an empty or failed request cannot leave earlier result cards visible', () => {
  const loading = searchSessionReducer(INITIAL_SEARCH_SESSION, {
    type: 'SUBMIT',
    query: 'oppenhiemer',
  });
  const empty = searchSessionReducer(loading, { type: 'EMPTY' });
  assert.equal(empty.phase, SEARCH_PHASE.EMPTY);
  assert.deepEqual(empty.results, []);

  const retrying = searchSessionReducer(empty, { type: 'SUBMIT', query: 'Oppenheimer' });
  const failed = searchSessionReducer(retrying, {
    type: 'FAIL',
    error: { title: 'No internet connection' },
  });
  assert.equal(failed.phase, SEARCH_PHASE.ERROR);
  assert.deepEqual(failed.results, []);
});

test('editing or clearing retires a committed search surface', () => {
  const results = {
    phase: SEARCH_PHASE.RESULTS,
    submittedQuery: 'Alien',
    results: [{ title: 'Alien' }],
    error: null,
  };

  assert.deepEqual(searchSessionReducer(results, { type: 'EDIT' }), INITIAL_SEARCH_SESSION);
  assert.deepEqual(searchSessionReducer(results, { type: 'CLEAR' }), INITIAL_SEARCH_SESSION);
});
