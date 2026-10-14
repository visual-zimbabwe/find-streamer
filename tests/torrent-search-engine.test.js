import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeQuery,
  formatSize,
  isSeasonPack,
  enhanceMagnet,
  parseReleaseAttributes,
  calculateMatchScore,
  extractSeasonEpisode,
  PUBLIC_TRACKERS,
} from '../src/lib/torrentSearchEngine.js';

test('sanitizeQuery removes punctuation and normalizes spaces', () => {
  assert.equal(sanitizeQuery("Grey's Anatomy: Season 1!"), 'Greys Anatomy Season 1');
  assert.equal(sanitizeQuery('Severance.S01E03.[1080p]'), 'Severance S01E03 1080p');
  assert.equal(sanitizeQuery('  Too   Many   Spaces  '), 'Too Many Spaces');
  assert.equal(sanitizeQuery(''), '');
  assert.equal(sanitizeQuery(null), '');
});

test('formatSize accurately formats byte sizes', () => {
  assert.equal(formatSize(10737418240), '10.00 GiB');
  assert.equal(formatSize(1572864000), '1.46 GiB');
  assert.equal(formatSize(52428800), '50.0 MiB');
  assert.equal(formatSize(51200), '50 KiB');
  assert.equal(formatSize(0), 'N/A');
  assert.equal(formatSize(-10), 'N/A');
  assert.equal(formatSize('invalid'), 'N/A');
});

test('extractSeasonEpisode correctly parses season and episode numbers', () => {
  assert.deepEqual(extractSeasonEpisode('Arcane.S01E01.1080p.WEB'), { season: 1, episode: 1 });
  assert.deepEqual(extractSeasonEpisode('Severance.1x03.720p.mkv'), { season: 1, episode: 3 });
  assert.deepEqual(extractSeasonEpisode('The.Bear.Season.2.Episode.10.1080p'), { season: 2, episode: 10 });
  assert.deepEqual(extractSeasonEpisode('Arcane S02E09 2160p 4K'), { season: 2, episode: 9 });
  assert.deepEqual(extractSeasonEpisode('Severance Complete Movie'), { season: null, episode: null });
});

test('isSeasonPack accurately detects batch and complete season releases', () => {
  assert.equal(isSeasonPack('Severance - Season 1 - Mp4 x264 AC3 1080p'), true);
  assert.equal(isSeasonPack('Severance.S01.Complete.1080p.WEB-DL'), true);
  assert.equal(isSeasonPack('Severance S01 Batch 720p'), true);
  assert.equal(isSeasonPack('Severance S01-S02 Complete'), true);
  // Single episodes should NOT be marked as season packs
  assert.equal(isSeasonPack('Severance S01E03 In Perpetuity 1080p'), false);
  assert.equal(isSeasonPack('Severance.s02e10.Cold.Harbor.720p'), false);
});

test('enhanceMagnet attaches all missing Tier-1 public trackers', () => {
  const hash = '34ff1fae9661d72152fb1fc31e27c15297072654';
  const enhanced = enhanceMagnet(hash, 'Severance S01');

  assert.match(enhanced, /^magnet:\?xt=urn:btih:34ff1fae9661d72152fb1fc31e27c15297072654/);
  assert.match(enhanced, /dn=Severance%20S01/);

  for (const tracker of PUBLIC_TRACKERS) {
    const encoded = encodeURIComponent(tracker);
    assert.ok(
      enhanced.includes(encoded) || enhanced.includes(tracker),
      `Expected tracker ${tracker} to be included in enhanced magnet`,
    );
  }
});

test('parseReleaseAttributes extracts resolution, codec and subtitles', () => {
  const res1 = parseReleaseAttributes('Severance S01E03 In Perpetuity 2160p 4K HEVC x265 10bit MULTi ESub');
  assert.equal(res1.resolution, '4K');
  assert.equal(res1.codec, 'x265');
  assert.equal(res1.is10Bit, true);
  assert.equal(res1.hasMultiAudio, true);
  assert.equal(res1.hasSubtitles, true);

  const res2 = parseReleaseAttributes('Severance S01E01 1080p WEB-DL x264');
  assert.equal(res2.resolution, '1080p');
  assert.equal(res2.codec, 'x264');
  assert.equal(res2.is10Bit, false);

  const res3 = parseReleaseAttributes('Severance 720p HDTV');
  assert.equal(res3.resolution, '720p');
});

test('calculateMatchScore gives massive bonus to targeted episode releases and rejects mismatched episodes', () => {
  const epScore = calculateMatchScore(
    'Severance S01E03 In Perpetuity 1080p BluRay',
    'Severance',
    { season: 1, episode: 3 }
  );

  const otherEpScore = calculateMatchScore(
    'Severance S01E04 The You You Are 1080p BluRay',
    'Severance',
    { season: 1, episode: 3 }
  );

  const wrongSeasonScore = calculateMatchScore(
    'Severance S02E03 In Perpetuity 1080p BluRay',
    'Severance',
    { season: 1, episode: 3 }
  );

  assert.ok(epScore > 150, `Expected epScore > 150, got ${epScore}`);
  assert.equal(otherEpScore, 0, 'Different episode must be rejected with score 0');
  assert.equal(wrongSeasonScore, 0, 'Different season must be rejected with score 0');
});
