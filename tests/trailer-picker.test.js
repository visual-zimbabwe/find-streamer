import test from 'node:test';
import assert from 'node:assert/strict';
import { rankTrailerCandidates } from '../src/lib/trailerPicker.js';

const video = (overrides) => ({
  site: 'YouTube',
  key: 'aaaaaaaaaaa',
  type: 'Trailer',
  official: true,
  iso_639_1: 'en',
  published_at: '2020-01-01T00:00:00.000Z',
  size: 1080,
  name: 'Official Trailer',
  ...overrides,
});

test('refuses to pass off a featurette as a trailer', () => {
  // The real regression: The Mentalist's button played "Behind the Scenes: The Designers"
  // because the old picker ended in "first YouTube video in the list".
  const picked = rankTrailerCandidates([
    video({ type: 'Behind the Scenes', key: 'behindthescn' }),
    video({ type: 'Featurette', key: 'featurette1' }),
    video({ type: 'Opening Credits', key: 'openingcred' }),
    video({ type: 'Clip', key: 'clipclipcli' }),
  ]);
  assert.deepEqual(picked, []);
});

test('tiers official trailer over official teaser over unofficial', () => {
  const picked = rankTrailerCandidates([
    video({ type: 'Teaser', official: false, key: 'unoffteaser' }),
    video({ type: 'Trailer', official: false, key: 'unofftrailr' }),
    video({ type: 'Teaser', official: true, key: 'offteaser11' }),
    video({ type: 'Trailer', official: true, key: 'offtrailer1' }),
  ]);
  assert.deepEqual(
    picked.map((c) => c.key),
    ['offtrailer1', 'offteaser11', 'unofftrailr', 'unoffteaser'],
  );
});

test('prefers English, then language-neutral, then anything else', () => {
  const picked = rankTrailerCandidates([
    video({ iso_639_1: 'ta', key: 'tamiltrailr' }),
    video({ iso_639_1: null, key: 'neutraltrlr' }),
    video({ iso_639_1: 'en', key: 'englishtrlr' }),
  ]);
  assert.deepEqual(
    picked.map((c) => c.key),
    ['englishtrlr', 'neutraltrlr', 'tamiltrailr'],
  );
});

test('a foreign-language official trailer still beats no trailer at all', () => {
  // Jana Nayagan (ta) has nothing else — an original-language trailer is the button.
  const picked = rankTrailerCandidates([video({ iso_639_1: 'ta', key: 'janatrailr1' })]);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].url, 'https://www.youtube.com/watch?v=janatrailr1');
  assert.equal(picked[0].type, 'Trailer');
});

test('within a tier the newest trailer wins', () => {
  const picked = rankTrailerCandidates([
    video({ key: 'oldtrailer1', published_at: '2018-05-01T00:00:00.000Z' }),
    video({ key: 'finaltrailr', published_at: '2019-11-01T00:00:00.000Z' }),
  ]);
  assert.equal(picked[0].key, 'finaltrailr');
});

test('drops non-YouTube sites and keyless entries', () => {
  const picked = rankTrailerCandidates([
    video({ site: 'Vimeo', key: 'vimeokey123' }),
    video({ key: null }),
    video({ key: 'goodkey1234' }),
  ]);
  assert.deepEqual(
    picked.map((c) => c.key),
    ['goodkey1234'],
  );
});

test('returns a bounded candidate list for the player to walk', () => {
  const many = Array.from({ length: 9 }, (_, i) =>
    video({ key: `key${String(i).padStart(8, '0')}`, published_at: `20${10 + i}-01-01T00:00:00.000Z` }),
  );
  const picked = rankTrailerCandidates(many);
  assert.equal(picked.length, 5);
  // Newest first.
  assert.equal(picked[0].key, 'key00000008');
});

test('tolerates junk input', () => {
  assert.deepEqual(rankTrailerCandidates(undefined), []);
  assert.deepEqual(rankTrailerCandidates(null), []);
  assert.deepEqual(rankTrailerCandidates([]), []);
  assert.deepEqual(rankTrailerCandidates([null, undefined]), []);
});
