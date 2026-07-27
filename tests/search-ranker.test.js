import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_SEARCH_QUERY_LENGTH,
  SEARCH_PANEL_MAX_ROWS,
  isRankablePersonDepartment,
  isSearchableQuery,
  normalizeSearchText,
  partitionSearchResults,
  rankSearchCandidates,
  searchMatchTier,
} from '../src/lib/searchRanker.js';

const title = (name, popularity, extra = {}) => ({
  resultType: 'media',
  mediaType: 'movie',
  tmdbId: name.length + Math.round(popularity),
  title: name,
  popularity,
  ...extra,
});

const person = (name, popularity, extra = {}) => ({
  resultType: 'person',
  personId: 900 + Math.round(popularity),
  tmdbId: 900 + Math.round(popularity),
  title: name,
  personName: name,
  popularity,
  ...extra,
});

// ── normalisation & tiers ─────────────────────────────────────────────────

test('normalisation folds case and drops punctuation', () => {
  assert.equal(normalizeSearchText("Schindler's List"), 'schindlers list');
  assert.equal(normalizeSearchText('  Law & Order  '), 'law  order');
  assert.equal(normalizeSearchText(null), '');
});

test('tiers rank a leading match above a word match above a bare substring', () => {
  assert.equal(searchMatchTier('Masters of the Universe', 'mast'), 0);
  assert.equal(searchMatchTier('Ink Master', 'mast'), 1);
  assert.equal(searchMatchTier('Beyond the Mast', 'beyond the mast'), 0);
  assert.equal(searchMatchTier('Grey&#39;s Anatomy', 'mast'), 3);
});

test('a substring that starts no word still beats no match at all', () => {
  // "aster" appears inside "Masters" but starts neither the title nor a word.
  assert.equal(searchMatchTier('Masters of the Universe', 'aster'), 2);
});

// ── the regression this module exists for ─────────────────────────────────

test('the title being typed leads, not whatever TMDb returned first', () => {
  // The shipped panel rendered TMDb's raw order and put "Beyond the Mast"
  // first for "Mast"; Masters of the Universe was not on screen at all.
  const payload = [
    title('Beyond the Mast', 3.2),
    title('Mast Qalandar', 1.1),
    title('Mast', 2.0),
    title('Ink Master', 12.0),
    title('Masters of the Universe', 48.5),
  ];

  const ranked = rankSearchCandidates(payload, 'Mast');

  assert.equal(ranked[0].title, 'Masters of the Universe');
  assert.equal(ranked[1].title, 'Mast');
  // "Beyond the Mast" only contains the query, so it sinks below both.
  assert.equal(ranked.at(-1).title, 'Beyond the Mast');
});

test('typing more never demotes a title that already led', () => {
  // "The Odyssey" was #1 at "The" and ABSENT at "The O" under the old order,
  // because The O.C. happened to come back higher.
  const payload = [title('The O.C.', 30), title('The Odyssey', 180)];

  for (const prefix of ['The', 'The O', 'The Ody']) {
    assert.equal(rankSearchCandidates(payload, prefix)[0].title, 'The Odyssey', `prefix ${prefix}`);
  }
});

test('no exact-title tier: a fragment that happens to be a title does not jump the queue', () => {
  // Measured as an 8.3-point regression across 701 prefixes — "Ma" exactly
  // matches the 2019 film, but the popular title the user is typing wins.
  const ranked = rankSearchCandidates([title('Ma', 9), title('Mad Max: Fury Road', 90)], 'Ma');
  assert.equal(ranked[0].title, 'Mad Max: Fury Road');
});

test('no vote floor: a brand-new thinly-voted title still ranks on popularity', () => {
  const ranked = rankSearchCandidates(
    [title('Dune Part One', 60, { voteCount: 12000 }), title('Dune Prophecy', 140, { voteCount: 8 })],
    'Dune',
  );
  assert.equal(ranked[0].title, 'Dune Prophecy');
});

test('ranking is stable and does not mutate its input', () => {
  const payload = [title('Alpha', 5), title('Beta', 5), title('Gamma', 5)];
  const snapshot = [...payload];
  const ranked = rankSearchCandidates(payload, 'zzz');
  assert.deepEqual(
    ranked.map((r) => r.title),
    ['Alpha', 'Beta', 'Gamma'],
  );
  assert.deepEqual(payload, snapshot);
});

test('empty and missing input rank to an empty list', () => {
  assert.deepEqual(rankSearchCandidates([], 'anything'), []);
  assert.deepEqual(rankSearchCandidates(null, 'anything'), []);
});

// ── people ────────────────────────────────────────────────────────────────

test('only Acting and Directing count as a rankable person', () => {
  assert.equal(isRankablePersonDepartment('Acting'), true);
  assert.equal(isRankablePersonDepartment('Directing'), true);
  // The departments that produced "Av (Production)" and "Ganes TH (Writing)".
  assert.equal(isRankablePersonDepartment('Production'), false);
  assert.equal(isRankablePersonDepartment('Writing'), false);
  assert.equal(isRankablePersonDepartment('Sound'), false);
  assert.equal(isRankablePersonDepartment(null), false);
});

test('a real person name still leads over titles that merely mention them', () => {
  const ranked = rankSearchCandidates(
    [title('Tom Hanks: The Nomad', 4), person('Tom Hanks', 40), title('Toy Story', 90)],
    'Tom Hanks',
  );
  assert.equal(ranked[0].resultType, 'person');
  assert.equal(ranked[0].title, 'Tom Hanks');
});

test('a loosely-matching person cannot outrank the title being typed', () => {
  // "Av" used to open the filmography of a Production credit named "Av".
  const ranked = rankSearchCandidates([person('Ava Mendez', 3), title('Avatar', 120)], 'Ava');
  assert.equal(ranked[0].title, 'Avatar');
});

test('partition keeps ranking order inside each group and reports the lead', () => {
  const ranked = [person('Zendaya', 50), title('Dune', 90), title('Euphoria', 20)];
  const { people, titles, leadsWithPerson } = partitionSearchResults(ranked);
  assert.equal(leadsWithPerson, true);
  assert.deepEqual(
    people.map((p) => p.title),
    ['Zendaya'],
  );
  assert.deepEqual(
    titles.map((t) => t.title),
    ['Dune', 'Euphoria'],
  );
});

test('partition tolerates an empty list', () => {
  const { people, titles, leadsWithPerson } = partitionSearchResults([]);
  assert.deepEqual(people, []);
  assert.deepEqual(titles, []);
  assert.equal(leadsWithPerson, false);
});

// ── query gate ────────────────────────────────────────────────────────────

test('a one-character query is not worth a request', () => {
  assert.equal(MIN_SEARCH_QUERY_LENGTH, 2);
  assert.equal(isSearchableQuery('m'), false);
  assert.equal(isSearchableQuery('  m  '), false);
  assert.equal(isSearchableQuery(''), false);
  assert.equal(isSearchableQuery(null), false);
  // Two characters is the floor because "Up" and "It" are real titles.
  assert.equal(isSearchableQuery('Up'), true);
  assert.equal(isSearchableQuery('It'), true);
});

test('punctuation alone does not clear the query gate', () => {
  assert.equal(isSearchableQuery('!!'), false);
});

test('the panel cap is where the measured value stops', () => {
  // Intended title visible: 76.9% at row 1, 78.7% by row 3, 79.0% by row 5 —
  // and unchanged all the way to row 20.
  assert.equal(SEARCH_PANEL_MAX_ROWS, 6);
});
