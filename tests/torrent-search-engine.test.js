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
  parseTorrentioSize,
  parseTorrentioSeeders,
  parseTorrentioSource,
  parseSizeToBytes,
  normalizeInfoHash,
  isArchiveRelease,
  classifyHealth,
  isDeadOrArchiveStream,
  deduplicateCandidates,
  computeSwarmRankWeight,
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

test('calculateMatchScore correctly scores movies and rejects TV releases or wrong year', () => {
  const movieScore = calculateMatchScore(
    'Inception (2010) 1080p BrRip x264 - 1.85GB - YIFY',
    'Inception',
    { year: 2010, isMovie: true }
  );
  assert.ok(movieScore >= 150, `Expected movieScore >= 150, got ${movieScore}`);

  // Rejects TV episodes when searching for a movie
  const tvEpScore = calculateMatchScore(
    'Inception S01E01 1080p HDTV',
    'Inception',
    { year: 2010, isMovie: true }
  );
  assert.equal(tvEpScore, 0, 'TV episodes must be rejected when searching for a movie');

  // Rejects season packs when searching for a movie
  const tvPackScore = calculateMatchScore(
    'Inception Season 1 Complete 720p',
    'Inception',
    { year: 2010, isMovie: true }
  );
  assert.equal(tvPackScore, 0, 'TV season packs must be rejected when searching for a movie');

  // Rejects movie remakes / different years differing by > 1 year
  const wrongYearScore = calculateMatchScore(
    'Halloween (1978) 1080p BluRay',
    'Halloween',
    { year: 2018, isMovie: true }
  );
  assert.equal(wrongYearScore, 0, 'Releases with conflicting years (> 1 year) must be rejected');

  // Allows festival release difference (+/- 1 year)
  const festivalScore = calculateMatchScore(
    'Parasite 2019 1080p BluRay',
    'Parasite',
    { year: 2020, isMovie: true }
  );
  assert.ok(festivalScore > 0, 'Releases with +/- 1 year difference should still match');
});

test('calculateMatchScore handles short movie titles accurately without substring bleed', () => {
  const upMatch = calculateMatchScore(
    'Up 2009 1080p BluRay x264',
    'Up',
    { year: 2009, isMovie: true }
  );
  assert.ok(upMatch > 0, 'Short title Up must match Up 2009');

  const superbadMatch = calculateMatchScore(
    'Superbad 2007 1080p',
    'Up',
    { year: 2009, isMovie: true }
  );
  assert.equal(superbadMatch, 0, 'Superbad must not match query Up');
});

test('parseTorrentioSize correctly parses sizes in GB, MB, KB, TB', () => {
  assert.equal(parseTorrentioSize('\u{1F464} 78 \u{1F4BE} 1.5 GB \u{2699}\u{FE0F} YTS'), 1610612736);
  assert.equal(parseTorrentioSize('\u{1F464} 5 \u{1F4BE} 744.37 MB \u{2699}\u{FE0F} Rutracker'), 780528517);
  assert.equal(parseTorrentioSize('\u{1F4BE} 500 KB'), 512000);
  assert.equal(parseTorrentioSize('no size here'), 0);
  assert.equal(parseTorrentioSize(''), 0);
});

test('parseTorrentioSeeders correctly extracts seed count', () => {
  assert.equal(parseTorrentioSeeders('\u{1F464} 78 \u{1F4BE} 1.5 GB \u{2699}\u{FE0F} YTS'), 78);
  assert.equal(parseTorrentioSeeders('\u{1F464} 0 \u{1F4BE} 1.5 GB'), 0);
  assert.equal(parseTorrentioSeeders('No icon here'), 0);
});

test('parseTorrentioSource extracts the origin source', () => {
  assert.equal(parseTorrentioSource('\u{1F464} 78 \u{1F4BE} 1.5 GB \u{2699}\u{FE0F} YTS'), 'YTS');
  assert.equal(parseTorrentioSource('\u{1F464} 5 \u{1F4BE} 18 GB \u{2699}\u{FE0F} Rutracker\nMulti Subs'), 'Rutracker');
  assert.equal(parseTorrentioSource('No gear icon'), 'torrentio');
});

test('enhanceMagnet includes extraTrackers when provided', () => {
  const hash = '34ff1fae9661d72152fb1fc31e27c15297072654';
  const custom = 'udp://custom.tracker.org:8080/announce';
  const enhanced = enhanceMagnet(hash, 'Test Title', [custom]);
  assert.ok(enhanced.includes(encodeURIComponent(custom)));
});

test('parseReleaseAttributes extracts audio badges for multi-audio, dubs, and foreign releases', () => {
  const rutorRelease = parseReleaseAttributes(
    'Sambre.S01E01.mkv',
    'Самбра / Sambre [S01] (2023) WEBRip 1080p | P\nSambre.S01E01.mkv\n👤 0 💾 2.43 GB ⚙️ Rutor\n🇷🇺',
  );
  assert.ok(rutorRelease.audioBadge);
  assert.equal(rutorRelease.audioBadge.text, '🇷🇺 Russian Dub');
  assert.equal(rutorRelease.audioBadge.isDub, true);

  const multiRelease = parseReleaseAttributes('Severance.S01E01.1080p.WEB.H264-MULTI.mkv');
  assert.ok(multiRelease.audioBadge);
  assert.equal(multiRelease.audioBadge.text, '🌐 Multi-Audio');
  assert.equal(multiRelease.audioBadge.isDub, false);

  const frenchRelease = parseReleaseAttributes('Sambre.S01E01.FRENCH.1080p.WEB.mkv');
  assert.ok(frenchRelease.audioBadge);
  assert.equal(frenchRelease.audioBadge.text, '🇫🇷 French Audio');
  assert.equal(frenchRelease.audioBadge.isDub, false);

  const italianRelease = parseReleaseAttributes('Film.2023.iTALiAN.1080p.mkv');
  assert.ok(italianRelease.audioBadge);
  assert.equal(italianRelease.audioBadge.text, '🇮🇹 Italian Audio');
  assert.equal(italianRelease.audioBadge.isDub, true);

  const cleanRelease = parseReleaseAttributes('Severance.S01E01.1080p.WEB-DL.DDP5.1.H.264-NTb.mkv');
  assert.equal(cleanRelease.audioBadge, null);
});

test('normalizeInfoHash converts both 40-char hex and 32-char Base32 hashes to lowercase hex', () => {
  assert.equal(
    normalizeInfoHash('34FF1FAE9661D72152FB1FC31E27C15297072654'),
    '34ff1fae9661d72152fb1fc31e27c15297072654',
  );
  // Base32 SubsPlease-style hash -> 40-char hex
  const hex = normalizeInfoHash('7MQKREFLWT6YWI7ZNTB434YSGIXXTORD');
  assert.match(hex, /^[0-9a-f]{40}$/);
});

test('parseSizeToBytes parses GB, GiB, MB, MiB strings', () => {
  assert.equal(parseSizeToBytes('1.5 GiB'), Math.round(1.5 * 1024 ** 3));
  assert.equal(parseSizeToBytes('750 MB'), 750_000_000);
  assert.equal(parseSizeToBytes('2.00&nbsp;GB'), 2_000_000_000);
  assert.equal(parseSizeToBytes('unknown'), 0);
});

test('isArchiveRelease flags rar/zip/7z releases and allows mkv/mp4 releases', () => {
  assert.equal(isArchiveRelease('Movie.2018.1080p.BluRay.RAR'), true);
  assert.equal(isArchiveRelease('Show.S01E01.720p.zip'), true);
  assert.equal(isArchiveRelease('The.Purity.of.Vengeance.2018.1080p.BluRay.x264.mkv'), false);
});

test('classifyHealth mirrors watchtv health tiers', () => {
  assert.equal(
    classifyHealth({
      liveSeeders: 5,
      scrapeVerified: true,
      probe: { checked: true, fullSeeds: 1, peersWithPieces: 1, handshakesOk: 1 },
    }).code,
    'READY',
  );
  assert.equal(classifyHealth({ liveSeeders: 25, scrapeVerified: true }).code, 'HIGH');
  assert.equal(classifyHealth({ liveSeeders: 6, liveLeechers: 10, scrapeVerified: true }).code, 'FAIR');
  assert.equal(classifyHealth({ liveSeeders: 1, scrapeVerified: true }).code, 'RISKY');
  assert.equal(classifyHealth({ liveSeeders: 0, scrapeVerified: true }).code, 'DEAD');
  assert.equal(classifyHealth({ liveSeeders: 50, isArchive: true, scrapeVerified: true }).code, 'ARCHIVE');
  assert.equal(classifyHealth({ reportedSeeders: 12, scrapeVerified: false }).code, 'UNVERIFIED');
});

test('deduplicateCandidates merges highest seeders, fileIdx, and combined sources', () => {
  const hash = '34ff1fae9661d72152fb1fc31e27c15297072654';
  const merged = deduplicateCandidates([
    { name: 'Journal 64 2018 1080p', infoHash: hash.toUpperCase(), seeders: 4, size: 0, source: 'apibay' },
    { name: 'Journal 64 2018 1080p', infoHash: hash, seeders: 32, leechers: 5, size: 2_000_000_000, fileIdx: 1, source: 'torrentio (YTS)' },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].seeders, 32);
  assert.equal(merged[0].fileIdx, 1);
  assert.equal(merged[0].size, 2_000_000_000);
  assert.ok(merged[0].source.includes('apibay') && merged[0].source.includes('torrentio (YTS)'));
});

test('computeSwarmRankWeight ranks probed READY swarms above dead/archive swarms', () => {
  const ready = {
    name: 'Journal 64 2018 1080p BluRay x265',
    score: 180,
    seeders: 20,
    liveSeeders: 20,
    scrapeVerified: true,
    size: 2 * 1024 ** 3,
    attributes: { resolution: '1080p', codec: 'x265' },
    probe: { checked: true, fullSeeds: 1, peersWithPieces: 1, handshakesOk: 1 },
    health: { code: 'READY' },
  };
  const archive = {
    ...ready,
    name: 'Journal 64 2018 1080p BluRay RAR',
    isArchive: true,
    health: { code: 'ARCHIVE' },
  };
  const dead = {
    ...ready,
    seeders: 0,
    liveSeeders: 0,
    probe: null,
    health: { code: 'DEAD' },
  };
  assert.ok(computeSwarmRankWeight(ready, { isMovie: true }) > computeSwarmRankWeight(archive, { isMovie: true }));
  assert.ok(computeSwarmRankWeight(ready, { isMovie: true }) > computeSwarmRankWeight(dead, { isMovie: true }));
  assert.equal(isDeadOrArchiveStream(ready), false);
  assert.equal(isDeadOrArchiveStream(archive), true);
  assert.equal(isDeadOrArchiveStream(dead), true);
});

