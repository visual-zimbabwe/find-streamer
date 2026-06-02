const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  loadWatchlist,
  saveWatchlist,
} = require(path.join(__dirname, '..', 'src', 'lib', 'storage.js'));
const { buildDefaultPrepopulatedWatchlist } = require(path.join(__dirname, '..', 'src', 'lib', 'defaultWatchlist.js'));
const { normalizeWatchlistItems } = require(path.join(__dirname, '..', 'src', 'lib', 'watchlistModel.js'));

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
      status: item.status,
      collectionIds: item.collectionIds,
    })),
    [
      {
        ...saved[0],
        status: 'saved',
        collectionIds: ['watch_next'],
      },
      {
        ...saved[1],
        status: 'saved',
        collectionIds: ['highly_recommend'],
      },
    ]
  );
});

test('fresh install loads an empty watchlist', async () => {
  const storage = createMemoryStorage();
  const loaded = await loadWatchlist(storage);

  assert.deepEqual(loaded, []);
  assert.equal(storage.writes.length, 1);
  assert.ok(storage.writes.some(([key]) => key === 'find-streamer/watchlist-imdb-migrated'));
});

test('loading a missing watchlist does not write defaults over later saves', async () => {
  const storage = createMemoryStorage();
  const defaults = await loadWatchlist(storage);

  assert.deepEqual(defaults, []);

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
  assert.equal(reloaded[0].status, 'watched');
});

test('imdb migration removes untouched default seeds but keeps engaged rows', async () => {
  const storage = createMemoryStorage();
  const seeded = normalizeWatchlistItems(buildDefaultPrepopulatedWatchlist()).slice(0, 4);
  const engaged = {
    tmdbId: 278,
    mediaType: 'movie',
    title: 'The Shawshank Redemption',
    status: 'watching',
    source: 'IMDb Top 100 - Movies',
    watchlistCategoryId: 'imdb_top_100_movies',
    collectionIds: ['imdb_top_100_movies'],
  };

  await saveWatchlist([...seeded, engaged], storage);
  const reloaded = await loadWatchlist(storage);

  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].title, 'The Shawshank Redemption');
  assert.equal(reloaded[0].status, 'watching');
  assert.ok(!reloaded[0].collectionIds.includes('imdb_top_100_movies'));
});

test('imdb migration keeps saved rows when user joined a library collection', async () => {
  const storage = createMemoryStorage();
  const saved = [{
    tmdbId: 278,
    mediaType: 'movie',
    title: 'The Shawshank Redemption',
    status: 'saved',
    source: 'IMDb Top 100 - Movies',
    watchlistCategoryId: 'imdb_top_100_movies',
    collectionIds: ['imdb_top_100_movies', 'watch_next'],
  }];

  await saveWatchlist(saved, storage);
  const reloaded = await loadWatchlist(storage);

  assert.equal(reloaded.length, 1);
  assert.ok(reloaded[0].collectionIds.includes('watch_next'));
  assert.ok(!reloaded[0].collectionIds.includes('imdb_top_100_movies'));
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
  assert.ok(storage.writes.some(([key, value]) => key === 'find-streamer/watchlist/chunks' && value === '20'));
  assert.ok(storage.writes.some(([key]) => key === 'find-streamer/watchlist/chunk/0'));
});

test('user watchlist saves stay compact without seeding imdb defaults', async () => {
  const storage = createMemoryStorage();
  const userItems = normalizeWatchlistItems([
    {
      tmdbId: 278,
      mediaType: 'movie',
      title: 'The Shawshank Redemption',
      watchlistCategoryId: 'watch_next',
      collectionIds: ['watch_next'],
    },
    {
      tmdbId: 1396,
      mediaType: 'tv',
      title: 'Breaking Bad',
      watchlistCategoryId: 'highly_recommend',
      collectionIds: ['highly_recommend'],
    },
  ]);

  await saveWatchlist(userItems, storage);
  const reloaded = await loadWatchlist(storage);

  assert.equal(reloaded.length, 2);
  assert.ok(!storage.writes.some(([, value]) => typeof value === 'string' && value.includes('imdb_top_100_movies')));
});

test('concurrent watchlist saves are serialized', async () => {
  const storage = createMemoryStorage();
  const base = {
    tmdbId: 278,
    mediaType: 'movie',
    title: 'The Shawshank Redemption',
    watchlistCategoryId: 'watch_next',
    collectionIds: ['watch_next'],
  };

  await saveWatchlist([base], storage);
  await Promise.all([
    saveWatchlist([{ ...base, collectionIds: ['watch_next', 'highly_recommend'] }], storage),
    saveWatchlist([{ ...base, collectionIds: ['watch_next', 'maybe_later'] }], storage),
  ]);

  const reloaded = await loadWatchlist(storage);
  assert.ok(reloaded[0].collectionIds.includes('watch_next'));
  assert.ok(
    reloaded[0].collectionIds.includes('highly_recommend')
    || reloaded[0].collectionIds.includes('maybe_later')
  );
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
