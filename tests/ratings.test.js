import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRatingValue } from '../src/lib/ratings.js';

test('resolveRatingValue prefers a positive numeric ratingValue', () => {
  assert.equal(resolveRatingValue({ ratingValue: 8.944, rating: '8.9/10' }), 8.944);
  // ratingValue wins even when the string would parse differently.
  assert.equal(resolveRatingValue({ ratingValue: 7.5, rating: '90%' }), 7.5);
});

test('resolveRatingValue parses a "/10" rating string', () => {
  assert.equal(resolveRatingValue({ rating: '8.8/10' }), 8.8);
  assert.equal(resolveRatingValue({ rating: '7.0/10' }), 7);
});

test('resolveRatingValue parses a bare numeric rating string', () => {
  assert.equal(resolveRatingValue({ rating: '8.8' }), 8.8);
});

test('resolveRatingValue rescales a percentage string onto the /10 scale', () => {
  // A Rotten Tomatoes "90%" must not sort above every /10-rated title.
  assert.equal(resolveRatingValue({ rating: '90%' }), 9);
  assert.equal(resolveRatingValue({ rating: '75%' }), 7.5);
  // A rescaled percentage stays below a genuine high /10 rating.
  assert.ok(resolveRatingValue({ rating: '90%' }) < resolveRatingValue({ rating: '9.5/10' }));
});

test('resolveRatingValue returns 0 for missing or unparseable ratings', () => {
  assert.equal(resolveRatingValue({}), 0);
  assert.equal(resolveRatingValue(null), 0);
  assert.equal(resolveRatingValue({ rating: '' }), 0);
  assert.equal(resolveRatingValue({ rating: 'N/A' }), 0);
  assert.equal(resolveRatingValue({ rating: 'unrated' }), 0);
  // A zero ratingValue falls through to the string.
  assert.equal(resolveRatingValue({ ratingValue: 0, rating: '8.2/10' }), 8.2);
});
