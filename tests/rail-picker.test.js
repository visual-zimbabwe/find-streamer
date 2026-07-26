import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABSOLUTE_MIN_RAIL_VOTES,
  MIN_RAIL_VOTES,
  creditsForPerson,
  railScore,
  rankCompanyCatalog,
  rankPeopleTitles,
  rankSimilarTitles,
  selectRailPeople,
} from '../src/lib/railPicker.js';

const raw = (overrides) => ({
  id: 1,
  title: 'A Film',
  poster_path: '/poster.jpg',
  vote_average: 7.5,
  vote_count: 5000,
  release_date: '2015-06-01',
  genre_ids: [18],
  ...overrides,
});

// ── More Like This ────────────────────────────────────────────────────────

test('drops the thinly-voted picks that used to lead the rail', () => {
  // The real regression: The Odyssey led with LANDEaD (10.0 from one vote) and
  // Moana with a 9.0 from two, because the old code sorted by vote_average.
  const picked = rankSimilarTitles(
    [
      raw({ id: 10, title: 'LANDEaD', vote_average: 10, vote_count: 1 }),
      raw({ id: 11, title: 'The Great Escape', vote_average: 7.9, vote_count: 2881 }),
      raw({ id: 12, title: 'Pídemela, amor', vote_average: 8.0, vote_count: 2 }),
      raw({ id: 13, title: 'The Chorus', vote_average: 7.7, vote_count: 2629 }),
      raw({ id: 14, title: 'Hornblower', vote_average: 7.5, vote_count: 62 }),
    ],
    'movie',
  );
  // LANDEaD (1 vote) and Pídemela, amor (2 votes) are below the hard floor and
  // cannot appear at any position; Hornblower backfills at 62.
  assert.deepEqual(
    picked.map((p) => p.title),
    ['The Great Escape', 'The Chorus', 'Hornblower'],
  );
});

test('preserves TMDb relevance order instead of re-sorting by rating', () => {
  const picked = rankSimilarTitles(
    [
      raw({ id: 20, title: 'Most Relevant', vote_average: 6.1, vote_count: 900 }),
      raw({ id: 21, title: 'Less Relevant', vote_average: 8.8, vote_count: 900 }),
    ],
    'movie',
  );
  assert.deepEqual(
    picked.map((p) => p.title),
    ['Most Relevant', 'Less Relevant'],
  );
});

test('backfills a short rail, best-supported first, but never below the hard floor', () => {
  const picked = rankSimilarTitles(
    [
      raw({ id: 30, title: 'Trusted', vote_count: 4000 }),
      raw({ id: 31, title: 'Thin 12 votes', vote_count: 12 }),
      raw({ id: 32, title: 'Thin 190 votes', vote_count: 190 }),
      raw({ id: 33, title: 'Thin 80 votes', vote_count: 80 }),
    ],
    'movie',
    { size: 4 },
  );
  assert.deepEqual(
    picked.map((p) => p.title),
    ['Trusted', 'Thin 190 votes', 'Thin 80 votes'],
  );
});

test('hides the rail entirely rather than showing a single stub card', () => {
  const picked = rankSimilarTitles(
    [
      raw({ id: 34, title: 'Only Trusted One', vote_count: 900 }),
      raw({ id: 35, title: 'One Vote Wonder', vote_average: 10, vote_count: 1 }),
    ],
    'movie',
  );
  assert.deepEqual(picked, []);
});

test('excludes posterless items, the current title, and duplicates', () => {
  const picked = rankSimilarTitles(
    [
      raw({ id: 40, title: 'No poster', poster_path: null }),
      raw({ id: 99, title: 'The title being viewed' }),
      raw({ id: 41, title: 'Keeper' }),
      raw({ id: 41, title: 'Keeper again' }),
      raw({ id: 42, title: 'Second Keeper' }),
    ],
    'movie',
    { currentTmdbId: 99 },
  );
  assert.deepEqual(
    picked.map((p) => p.title),
    ['Keeper', 'Second Keeper'],
  );
});

test('carries mediaType through so a TV recommendation opens a TV page', () => {
  const picked = rankSimilarTitles(
    [
      // TV payloads carry first_air_date and no release_date.
      raw({ id: 50, name: 'A Series', title: null, release_date: null, first_air_date: '2011-04-17' }),
      raw({ id: 51, name: 'Another Series', title: null, release_date: null }),
    ],
    'tv',
  );
  assert.equal(picked[0].mediaType, 'tv');
  assert.equal(picked[0].title, 'A Series');
  assert.equal(picked[0].year, '2011');
});

// ── More From Cast & Crew ─────────────────────────────────────────────────

test('picks people director-first, deduped, capped', () => {
  const people = selectRailPeople({
    directorPersons: [{ id: 1, name: 'Christopher Nolan', job: 'Director' }],
    starringPersons: [
      { id: 2, name: 'Matt Damon' },
      { id: 1, name: 'Christopher Nolan' },
      { id: 3, name: 'Anne Hathaway' },
    ],
    writerPersons: [{ id: 4, name: 'Jonathan Nolan', job: 'Writer' }],
    composerPersons: [{ id: 5, name: 'Ludwig Göransson' }],
  });
  assert.deepEqual(
    people.map((p) => p.name),
    ['Christopher Nolan', 'Matt Damon', 'Anne Hathaway', 'Jonathan Nolan'],
  );
  assert.equal(people[0].roleLabel, 'Director');
});

test('attributes each credit to the person it came from', () => {
  const items = creditsForPerson(
    { id: 7, name: 'Chiwetel Ejiofor', roleLabel: 'Cast' },
    {
      cast: [raw({ id: 60, title: '12 Years a Slave', order: 0 })],
      crew: [],
    },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].viaPersonName, 'Chiwetel Ejiofor');
  assert.equal(items[0].viaRole, 'Cast');
});

test('reports the role held on the recommended title, not the viewed one', () => {
  const items = creditsForPerson(
    { id: 8, name: 'Christopher Nolan', roleLabel: 'Director' },
    { cast: [], crew: [raw({ id: 61, title: 'Interstellar', job: 'Director' })] },
  );
  assert.equal(items[0].viaRole, 'Director');
});

test('ignores talk shows, documentaries, walk-on roles and gaffer credits', () => {
  const items = creditsForPerson(
    { id: 9, name: 'Someone', roleLabel: 'Cast' },
    {
      cast: [
        raw({ id: 70, title: 'Late Night Chat', genre_ids: [10767], order: 0 }),
        raw({ id: 71, title: 'A Documentary', genre_ids: [99], order: 0 }),
        raw({ id: 72, title: 'One Scene Walk-on', order: 44 }),
        raw({ id: 73, title: 'Thinly Voted', order: 1, vote_count: 20 }),
        raw({ id: 74, title: 'Genuine Lead', order: 1 }),
      ],
      crew: [raw({ id: 75, title: 'Gaffer Job', job: 'Gaffer' })],
    },
  );
  assert.deepEqual(
    items.map((i) => i.title),
    ['Genuine Lead'],
  );
});

test('rejects a one-episode guest spot on a long-running show', () => {
  // The Simpsons surfaced on 16 of 100 pages on the first cut, because almost
  // every working actor has a single guest voice credit on it.
  const items = creditsForPerson(
    { id: 11, name: 'Guest Voice', roleLabel: 'Cast' },
    {
      cast: [
        raw({ id: 80, name: 'The Simpsons', title: null, media_type: 'tv', order: 3, episode_count: 1 }),
        raw({ id: 81, name: 'Their Own Series', title: null, media_type: 'tv', order: 0, episode_count: 42 }),
      ],
      crew: [
        raw({ id: 82, name: '2 Broke Girls', title: null, media_type: 'tv', job: 'Director', episode_count: 1 }),
      ],
    },
  );
  assert.deepEqual(
    items.map((i) => i.title),
    ['Their Own Series'],
  );
});

test('the episode floor does not touch films', () => {
  const items = creditsForPerson(
    { id: 12, name: 'Film Actor', roleLabel: 'Cast' },
    { cast: [raw({ id: 83, title: 'A Film', media_type: 'movie', order: 0 })], crew: [] },
  );
  assert.equal(items.length, 1);
});

test('interleaves people so the most prolific name cannot own every card', () => {
  // The old OR-joined discover query put Infinity War on 11 of 100 pages.
  const groups = [
    {
      person: { id: 1, name: 'Prolific' },
      items: [
        { mediaType: 'movie', tmdbId: 1, title: 'P1', score: 40, viaPersonName: 'Prolific' },
        { mediaType: 'movie', tmdbId: 2, title: 'P2', score: 39, viaPersonName: 'Prolific' },
        { mediaType: 'movie', tmdbId: 3, title: 'P3', score: 38, viaPersonName: 'Prolific' },
      ],
    },
    {
      person: { id: 2, name: 'Other' },
      items: [{ mediaType: 'movie', tmdbId: 4, title: 'O1', score: 5, viaPersonName: 'Other' }],
    },
  ];
  const picked = rankPeopleTitles(groups, { size: 4 });
  assert.deepEqual(
    picked.map((p) => p.title),
    ['P1', 'O1', 'P2', 'P3'],
  );
});

test('rankPeopleTitles dedupes a title two people share', () => {
  const shared = { mediaType: 'movie', tmdbId: 100, title: 'Shared', score: 10 };
  const picked = rankPeopleTitles([
    { person: { id: 1, name: 'A' }, items: [{ ...shared, viaPersonName: 'A' }] },
    { person: { id: 2, name: 'B' }, items: [{ ...shared, viaPersonName: 'B' }] },
  ]);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].viaPersonName, 'A');
});

test('railScore lets a well-supported good film beat a thin great one', () => {
  assert.ok(railScore(7.9, 40000) > railScore(8.6, 210));
});

test('MIN_RAIL_VOTES is the documented floor', () => {
  assert.equal(MIN_RAIL_VOTES, 200);
});

// ── Studio catalogue ──────────────────────────────────────────────────────

const row = (overrides) => ({ mediaType: 'movie', tmdbId: 1, title: 'A Film', voteCount: 5000, ...overrides });

test('rankCompanyCatalog drops the thin titles that used to lead a studio page', () => {
  // The real regression: Walt Disney Pictures opened with Radio Disney Music
  // Awards (9.6 from 7 votes) and a 1989 safety PSA, because the catalogue was
  // sorted by vote_average behind a 5-vote floor.
  const picked = rankCompanyCatalog([
    row({ tmdbId: 10, title: 'Radio Disney Music Awards', voteCount: 7 }),
    row({ tmdbId: 11, title: 'Street Safe, Street Smart', voteCount: 38 }),
    row({ tmdbId: 12, title: 'The Lion King', voteCount: 18000 }),
    row({ tmdbId: 13, title: 'Frozen', voteCount: 16000 }),
  ]);
  assert.deepEqual(
    picked.map((item) => item.title),
    ['The Lion King', 'Frozen'],
  );
});

test('rankCompanyCatalog preserves the popularity order it was handed', () => {
  const picked = rankCompanyCatalog([
    row({ tmdbId: 1, title: 'Second Best', voteCount: 900 }),
    row({ tmdbId: 2, title: 'Most Popular', voteCount: 300 }),
  ]);
  assert.deepEqual(
    picked.map((item) => item.title),
    ['Second Best', 'Most Popular'],
  );
});

test('rankCompanyCatalog falls to the hard floor for a small studio', () => {
  // One title over the preferred floor is not a page. Dropping to the hard
  // floor is better than showing a single card — but 40 votes still never shows.
  const picked = rankCompanyCatalog([
    row({ tmdbId: 1, title: 'Their One Hit', voteCount: 4000 }),
    row({ tmdbId: 2, title: 'A Modest Second', voteCount: 120 }),
    row({ tmdbId: 3, title: 'Barely Rated', voteCount: 40 }),
  ]);
  assert.deepEqual(
    picked.map((item) => item.title),
    ['Their One Hit', 'A Modest Second'],
  );
});

test('rankCompanyCatalog does not cap the grid the way a rail is capped', () => {
  const many = Array.from({ length: 30 }, (_, i) => row({ tmdbId: i, title: `Film ${i}` }));
  assert.equal(rankCompanyCatalog(many).length, 30);
});

test('rankCompanyCatalog survives a missing voteCount', () => {
  assert.deepEqual(rankCompanyCatalog([{ title: 'No Votes Field' }]), []);
  assert.deepEqual(rankCompanyCatalog(null), []);
});

test('the studio floors are the rail floors, not a second set of numbers', () => {
  assert.equal(MIN_RAIL_VOTES, 200);
  assert.equal(ABSOLUTE_MIN_RAIL_VOTES, 50);
});
