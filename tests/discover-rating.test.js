import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeRatingInput,
  normalizeAppliedRating,
  validateRatingRange,
} from '../src/lib/discoverRating.js';

test('sanitizeRatingInput strips non-numeric characters and limits decimals', () => {
  assert.equal(sanitizeRatingInput('6.7abc'), '6.7');
  assert.equal(sanitizeRatingInput('6.75'), '6.7');
  assert.equal(sanitizeRatingInput('6.'), '6.');
  assert.equal(sanitizeRatingInput('12.3'), '12.3');
});

test('normalizeAppliedRating coerces trailing dots and treats zero as empty', () => {
  assert.equal(normalizeAppliedRating(''), null);
  assert.equal(normalizeAppliedRating('0'), null);
  assert.equal(normalizeAppliedRating('0.0'), null);
  assert.equal(normalizeAppliedRating('6.'), 6);
  assert.equal(normalizeAppliedRating('10.0'), 10);
  assert.equal(normalizeAppliedRating('6.7'), 6.7);
});

test('normalizeAppliedRating rejects invalid values', () => {
  assert.ok(Number.isNaN(normalizeAppliedRating('11')));
  assert.ok(Number.isNaN(normalizeAppliedRating('-1')));
  assert.ok(Number.isNaN(normalizeAppliedRating('6.75')));
});

test('validateRatingRange accepts partial and full ranges', () => {
  assert.equal(validateRatingRange('7', '10.0'), null);
  assert.equal(validateRatingRange('6.5', ''), null);
  assert.equal(validateRatingRange('', '7.0'), null);
  assert.equal(validateRatingRange('', ''), null);
  assert.ok(validateRatingRange('8', '7'));
});
