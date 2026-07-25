const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSoundtrackRows,
  commonsCoverUrl,
  isBareQid,
  labelOrNull,
  lookupCommonsThumb,
  parseSoundtracksFromBindings,
  resolveCommonsThumbUrls,
  resolveSoundtrackCovers,
  sortSoundtracks,
  stripLeadingTitle,
  yearFromWikidataDate,
} = require('../src/lib/wikidataSoundtracks.js');

function wikidataIdFromUri(uri) {
  const match = String(uri || '').match(/\/entity\/(Q\d+)$/i);
  return match ? match[1].toUpperCase() : null;
}

test('yearFromWikidataDate extracts year only', () => {
  assert.equal(yearFromWikidataDate('2003-05-23T00:00:00Z'), 2003);
  assert.equal(yearFromWikidataDate('+1999-01-01T00:00:00Z'), 1999);
  assert.equal(yearFromWikidataDate(null), null);
});

test('commonsCoverUrl builds a Special:FilePath URL', () => {
  assert.equal(
    commonsCoverUrl('Inception soundtrack cover.jpg'),
    'https://commons.wikimedia.org/wiki/Special:FilePath/Inception_soundtrack_cover.jpg',
  );
  assert.equal(
    commonsCoverUrl('File:Example.png'),
    'https://commons.wikimedia.org/wiki/Special:FilePath/Example.png',
  );
});

test('commonsCoverUrl normalizes full Commons URLs', () => {
  assert.equal(
    commonsCoverUrl('http://commons.wikimedia.org/wiki/Special:FilePath/Oscar-free-version.svg'),
    'https://commons.wikimedia.org/wiki/Special:FilePath/Oscar-free-version.svg',
  );
});

test('resolveCommonsThumbUrls returns upload.wikimedia.org thumbnails', async () => {
  const thumbMap = await resolveCommonsThumbUrls(['La La Land Logo.svg', 'Oscar-free-version.svg']);
  assert.match(
    lookupCommonsThumb('La La Land Logo.svg', thumbMap),
    /upload\.wikimedia\.org.*\.png/,
  );
  assert.match(
    lookupCommonsThumb('Oscar-free-version.svg', thumbMap),
    /upload\.wikimedia\.org.*\.png/,
  );
});

test('parseSoundtracksFromBindings dedupes, filters, and sorts soundtracks', () => {
  const bindings = [
    {
      soundtrack: { value: 'http://www.wikidata.org/entity/Q2' },
      soundtrackLabel: { value: 'Z Album' },
      spotifyAlbumId: { value: 'spotify-z' },
      releaseDate: { value: '2010-01-01T00:00:00Z' },
    },
    {
      soundtrack: { value: 'http://www.wikidata.org/entity/Q1' },
      soundtrackLabel: { value: 'A Album' },
      spotifyAlbumId: { value: 'spotify-a' },
      releaseDate: { value: '2001-01-01T00:00:00Z' },
      cover: { value: 'Cover A.jpg' },
    },
    {
      soundtrack: { value: 'http://www.wikidata.org/entity/Q1' },
      soundtrackLabel: { value: 'A Album duplicate' },
      spotifyAlbumId: { value: 'spotify-a-dup' },
    },
    {
      soundtrack: { value: 'http://www.wikidata.org/entity/Q3' },
      soundtrackLabel: { value: 'Missing Spotify' },
    },
  ];

  const soundtracks = parseSoundtracksFromBindings(bindings, wikidataIdFromUri);

  assert.equal(soundtracks.length, 2);
  assert.equal(soundtracks[0].wikidataId, 'Q1');
  assert.equal(soundtracks[0].title, 'A Album');
  assert.equal(soundtracks[0].year, 2001);
  assert.equal(soundtracks[0].spotifyAlbumId, 'spotify-a');
  assert.equal(soundtracks[1].wikidataId, 'Q2');
});

test('sortSoundtracks orders by year then title', () => {
  const sorted = sortSoundtracks([
    { title: 'Beta', year: 2000 },
    { title: 'Alpha', year: 2000 },
    { title: 'No Year' },
    { title: 'Early', year: 1999 },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.title),
    ['Early', 'Alpha', 'Beta', 'No Year'],
  );
});

test('sortSoundtracks puts unnamed releases last within a year', () => {
  const sorted = sortSoundtracks([
    { title: null, year: 2004 },
    { title: 'Departure', year: 2004 },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.title),
    ['Departure', null],
  );
});

test('isBareQid catches the label service returning a database key', () => {
  assert.equal(isBareQid('Q123137009'), true);
  assert.equal(isBareQid('  Q2986171 '), true);
  assert.equal(isBareQid('Quiz Show'), false);
  assert.equal(isBareQid('Q'), false);
  assert.equal(isBareQid(null), false);
});

test('labelOrNull rejects entity URIs and bare QIDs, keeps real names', () => {
  assert.equal(labelOrNull('http://www.wikidata.org/entity/Q42'), null);
  assert.equal(labelOrNull('Q123137009'), null);
  assert.equal(labelOrNull(''), null);
  assert.equal(labelOrNull('Skyfall'), 'Skyfall');
});

// Killers of the Flower Moon (tt5537002) really does resolve this way: the
// release is playable but Wikidata has no label for it, so the old guard let
// "Q123137009" through as the button's entire text.
test('parseSoundtracksFromBindings keeps an unlabelled but playable release', () => {
  const soundtracks = parseSoundtracksFromBindings(
    [
      {
        soundtrack: { value: 'http://www.wikidata.org/entity/Q123137009' },
        soundtrackLabel: { value: 'Q123137009' },
        spotifyAlbumId: { value: '43MjCtL4DwTxc1DhXK9Kpp' },
      },
    ],
    wikidataIdFromUri,
  );

  assert.equal(soundtracks.length, 1);
  assert.equal(soundtracks[0].title, null);
  assert.equal(soundtracks[0].spotifyAlbumId, '43MjCtL4DwTxc1DhXK9Kpp');
});

test('stripLeadingTitle drops the film name but never empties the row', () => {
  assert.equal(
    stripLeadingTitle('Frankenweenie – Original Motion Picture Soundtrack', 'Frankenweenie'),
    'Original Motion Picture Soundtrack',
  );
  assert.equal(
    stripLeadingTitle('Samurai Champloo Music Record: Impression', 'Samurai Champloo'),
    'Music Record: Impression',
  );
  // Album named exactly after its film — stripping would leave nothing.
  assert.equal(stripLeadingTitle('Skyfall', 'Skyfall'), 'Skyfall');
  // No shared prefix, so nothing to strip.
  assert.equal(stripLeadingTitle('More Music from 8 Mile', '8 Mile'), 'More Music from 8 Mile');
  assert.equal(stripLeadingTitle('Lady Marmalade', 'Moulin Rouge!'), 'Lady Marmalade');
});

test('buildSoundtrackRows hides a year that every row shares', () => {
  // Frankenweenie's two releases are both 2012 — the year separates nothing.
  const rows = buildSoundtrackRows(
    [
      { wikidataId: 'Q1', title: 'Frankenweenie Unleashed! – Music Inspired', year: 2012 },
      { wikidataId: 'Q2', title: 'Frankenweenie – Original Motion Picture Soundtrack', year: 2012 },
    ],
    'Frankenweenie',
  );

  assert.deepEqual(
    rows.map((row) => row.displayTitle),
    ['Unleashed! – Music Inspired', 'Original Motion Picture Soundtrack'],
  );
  assert.deepEqual(
    rows.map((row) => row.showYear),
    [false, false],
  );
});

test('buildSoundtrackRows keeps a year that distinguishes rows', () => {
  // Yellow Submarine's two releases are 30 years apart — the year is the point.
  const rows = buildSoundtrackRows(
    [
      { wikidataId: 'Q1', title: 'Yellow Submarine', year: 1969 },
      { wikidataId: 'Q2', title: 'Yellow Submarine Songtrack', year: 1999 },
    ],
    'Yellow Submarine',
  );

  assert.deepEqual(
    rows.map((row) => row.displayTitle),
    ['Yellow Submarine', 'Songtrack'],
  );
  assert.deepEqual(
    rows.map((row) => row.showYear),
    [true, true],
  );
});

test('buildSoundtrackRows labels an unnamed release', () => {
  const rows = buildSoundtrackRows([{ wikidataId: 'Q1', title: null, year: null }], 'Naadu');

  assert.equal(rows[0].displayTitle, 'Untitled release');
  assert.equal(rows[0].showYear, false);
});

// Watchlist entries enriched before the QID guard shipped still hold a bare QID
// in storage and never pass back through the parser.
test('buildSoundtrackRows catches a QID cached by an older build', () => {
  const rows = buildSoundtrackRows(
    [{ wikidataId: 'Q123137009', title: 'Q123137009', year: null }],
    'Killers of the Flower Moon',
  );

  assert.equal(rows[0].displayTitle, 'Untitled release');
});

test('resolveSoundtrackCovers is a no-op with no request when nothing has art', async () => {
  const input = [{ wikidataId: 'Q1', title: 'A', coverValue: null, coverUrl: null }];
  assert.deepEqual(await resolveSoundtrackCovers(input), input);
});

test('resolveSoundtrackCovers swaps originals for thumbnails', async () => {
  const [row] = await resolveSoundtrackCovers([
    {
      wikidataId: 'Q1',
      title: 'A',
      coverValue: 'Oscar-free-version.svg',
      coverUrl: commonsCoverUrl('Oscar-free-version.svg'),
    },
  ]);

  assert.match(row.coverUrl, /upload\.wikimedia\.org.*\.png/);
});
