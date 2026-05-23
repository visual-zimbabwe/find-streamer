const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  loadWatchlist,
  saveWatchlist,
} = require(path.join(__dirname, '..', 'src', 'lib', 'storage.js'));

function createMemoryStorage(initialEntries = []) {
  const values = new Map(initialEntries);
  const writes = [];

  return {
    writes,
    async getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      writes.push([key, value]);
      values.set(key, value);
    },
    async multiSet(entries) {
      writes.push(...entries);
      entries.forEach(([key, value]) => values.set(key, value));
    },
    async multiGet(keys) {
      return keys.map((key) => [key, values.has(key) ? values.get(key) : null]);
    },
    async multiRemove(keys) {
      keys.forEach((key) => values.delete(key));
    },
  };
}

test('watchlist persists across a simulated app restart', async () => {
  const storage = createMemoryStorage();
  const saved = [
    {
      tmdbId: 1396,
      mediaType: 'tv',
      title: 'Breaking Bad',
      watchlistCategoryId: 'watch_next',
    },
    {
      tmdbId: 603,
      mediaType: 'movie',
      title: 'The Matrix',
      watchlistCategoryId: 'highly_recommend',
    },
  ];

  await saveWatchlist(saved, storage);
  const reloaded = await loadWatchlist(storage);

  assert.deepEqual(
    reloaded.map((item) => ({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      watchlistCategoryId: item.watchlistCategoryId,
    })),
    saved
  );
});

test('loading a missing watchlist does not write defaults over later saves', async () => {
  const storage = createMemoryStorage();
  const defaults = await loadWatchlist(storage);

  assert.ok(defaults.length > 0);
  assert.equal(storage.writes.length, 0);

  const custom = [{
    tmdbId: 11,
    mediaType: 'movie',
    title: 'Star Wars',
    watchlistCategoryId: 'watched',
  }];

  await saveWatchlist(custom, storage);
  const reloaded = await loadWatchlist(storage);

  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].title, 'Star Wars');
  assert.equal(reloaded[0].watchlistCategoryId, 'watched');
});

test('an intentionally empty watchlist stays empty across restart', async () => {
  const storage = createMemoryStorage();

  await saveWatchlist([], storage);

  const reloaded = await loadWatchlist(storage);

  assert.deepEqual(reloaded, []);
});

test('large imported watchlists are chunked and survive restart', async () => {
  const storage = createMemoryStorage();
  const saved = Array.from({ length: 500 }, (_, index) => ({
    tmdbId: 1000 + index,
    mediaType: index % 2 === 0 ? 'movie' : 'tv',
    title: `Imported Title ${index}`,
    posterUrl: `https://image.tmdb.org/t/p/w500/poster-${index}.jpg`,
    backdropUrl: `https://image.tmdb.org/t/p/original/backdrop-${index}.jpg`,
    synopsis: 'A longer imported synopsis that makes this row closer to a real backup payload.',
    watchlistCategoryId: index % 3 === 0 ? 'highly_recommend' : 'watch_next',
  }));

  await saveWatchlist(saved, storage);
  const reloaded = await loadWatchlist(storage);

  assert.equal(reloaded.length, 500);
  assert.equal(reloaded[0].title, 'Imported Title 0');
  assert.equal(reloaded[499].title, 'Imported Title 499');
  assert.ok(storage.writes.some(([key, value]) => key === 'find-streamer/watchlist/chunks' && value === '10'));
  assert.ok(storage.writes.some(([key]) => key === 'find-streamer/watchlist/chunk/0'));
});

test('chunked watchlists load before an unreadable legacy single-key value', async () => {
  const storage = createMemoryStorage([
    ['find-streamer/watchlist/chunks', '1'],
    ['find-streamer/watchlist/chunk/0', JSON.stringify([{
      tmdbId: 77,
      mediaType: 'movie',
      title: 'Chunked Value',
      watchlistCategoryId: 'watch_next',
    }])],
  ]);
  storage.getItem = async (key) => {
    if (key === 'find-streamer/watchlist') {
      throw new Error('legacy value too large to read');
    }
    return storage.multiGet([key]).then((rows) => rows[0][1]);
  };

  const reloaded = await loadWatchlist(storage);

  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].title, 'Chunked Value');
});
