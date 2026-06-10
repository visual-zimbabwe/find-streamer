const test = require('node:test');
const assert = require('node:assert/strict');

const {
  commonsCoverUrl,
  lookupCommonsThumb,
  parseSoundtracksFromBindings,
  resolveCommonsThumbUrls,
  sortSoundtracks,
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
  assert.equal(commonsCoverUrl('File:Example.png'), 'https://commons.wikimedia.org/wiki/Special:FilePath/Example.png');
});

test('commonsCoverUrl normalizes full Commons URLs', () => {
  assert.equal(
    commonsCoverUrl('http://commons.wikimedia.org/wiki/Special:FilePath/Oscar-free-version.svg'),
    'https://commons.wikimedia.org/wiki/Special:FilePath/Oscar-free-version.svg',
  );
});

test('resolveCommonsThumbUrls returns upload.wikimedia.org thumbnails', async () => {
  const thumbMap = await resolveCommonsThumbUrls(['La La Land Logo.svg', 'Oscar-free-version.svg']);
  assert.match(lookupCommonsThumb('La La Land Logo.svg', thumbMap), /upload\.wikimedia\.org.*\.png/);
  assert.match(lookupCommonsThumb('Oscar-free-version.svg', thumbMap), /upload\.wikimedia\.org.*\.png/);
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

  assert.deepEqual(sorted.map((item) => item.title), ['Early', 'Alpha', 'Beta', 'No Year']);
});
