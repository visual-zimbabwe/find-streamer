import test from 'node:test';
import assert from 'node:assert/strict';
import { tmdbImageAtSize } from '../src/lib/tmdbImages.js';

// Every mapper in tmdb.js bakes `w500` into `posterUrl`. Search draws the same
// field at three different sizes, so the rewrite has to be exact and has to
// leave non-TMDb art alone.

test('rewrites a poster rendition', () => {
  assert.equal(
    tmdbImageAtSize('https://image.tmdb.org/t/p/w500/abc.jpg', 'w342'),
    'https://image.tmdb.org/t/p/w342/abc.jpg',
  );
});

test('rewrites upward for the top match', () => {
  assert.equal(
    tmdbImageAtSize('https://image.tmdb.org/t/p/w500/abc.jpg', 'w780'),
    'https://image.tmdb.org/t/p/w780/abc.jpg',
  );
});

test('rewrites an original, which is what the old top-match card pulled', () => {
  assert.equal(
    tmdbImageAtSize('https://image.tmdb.org/t/p/original/abc.jpg', 'w780'),
    'https://image.tmdb.org/t/p/w780/abc.jpg',
  );
});

test('leaves non-TMDb artwork untouched', () => {
  const commons = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Poster.jpg';
  assert.equal(tmdbImageAtSize(commons, 'w342'), commons);
});

test('a missing poster stays missing rather than becoming a broken URL', () => {
  assert.equal(tmdbImageAtSize(null, 'w342'), null);
  assert.equal(tmdbImageAtSize(undefined, 'w342'), null);
});

test('only the rendition segment changes, never a path that looks like one', () => {
  assert.equal(
    tmdbImageAtSize('https://image.tmdb.org/t/p/w500/w500original.jpg', 'w342'),
    'https://image.tmdb.org/t/p/w342/w500original.jpg',
  );
});
