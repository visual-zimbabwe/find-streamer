import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RATING_MIN,
  RATING_MAX,
  RUNTIME_MAX,
  YEAR_MIN,
  yearMax,
  ratingLowFromFilters,
  ratingHighFromFilters,
  ratingFiltersFromRange,
  yearLowFromFilters,
  yearHighFromFilters,
  yearFiltersFromRange,
  runtimeLowFromFilters,
  runtimeHighFromFilters,
  runtimeFiltersFromRange,
  formatRatingRange,
  formatYearRange,
  formatRuntimeRange,
} from '../src/lib/discoverRanges.js';

test('rating: reads the shipped default (7 – 10.0) as [7, 10]', () => {
  assert.equal(ratingLowFromFilters('7'), 7);
  assert.equal(ratingHighFromFilters('10.0'), 10);
});

test('rating: empty / zero low maps to the RATING_MIN extreme', () => {
  assert.equal(ratingLowFromFilters(''), RATING_MIN);
  assert.equal(ratingLowFromFilters(null), RATING_MIN);
});

test('rating: clamps out-of-range values', () => {
  assert.equal(ratingHighFromFilters('99'), RATING_MAX);
  assert.equal(ratingLowFromFilters('-3'), RATING_MIN);
});

test('rating writeback: floor low → "0" (no gte), ceiling high → "10.0"', () => {
  assert.deepEqual(ratingFiltersFromRange(0, 10), { minRating: '0', maxRating: '10.0' });
});

test('rating writeback: interior values keep one decimal', () => {
  assert.deepEqual(ratingFiltersFromRange(6.5, 8), { minRating: '6.5', maxRating: '8.0' });
});

test('rating round-trips the default', () => {
  const low = ratingLowFromFilters('7');
  const high = ratingHighFromFilters('10.0');
  assert.deepEqual(ratingFiltersFromRange(low, high), { minRating: '7.0', maxRating: '10.0' });
});

test('year: empty maps to the extremes', () => {
  const now = new Date('2026-08-01');
  assert.equal(yearLowFromFilters(''), YEAR_MIN);
  assert.equal(yearHighFromFilters(''), yearMax(now));
});

test('year: a full-width range writes back as "Any" (both empty)', () => {
  const now = new Date('2026-08-01');
  const hi = yearMax(now);
  assert.deepEqual(yearFiltersFromRange(YEAR_MIN, hi, now), { fromYear: '', toYear: '' });
});

test('year: an interior range writes concrete years', () => {
  const now = new Date('2026-08-01');
  assert.deepEqual(yearFiltersFromRange(2010, 2024, now), { fromYear: '2010', toYear: '2024' });
});

test('year: high thumb at the ceiling stays unbounded on the top', () => {
  const now = new Date('2026-08-01');
  const hi = yearMax(now);
  assert.deepEqual(yearFiltersFromRange(2010, hi, now), { fromYear: '2010', toYear: '' });
});

test('runtime: empty maps to the extremes', () => {
  assert.equal(runtimeLowFromFilters(''), 0);
  assert.equal(runtimeHighFromFilters(''), RUNTIME_MAX);
});

test('runtime: full-width writes back empty', () => {
  assert.deepEqual(runtimeFiltersFromRange(0, RUNTIME_MAX), { minRuntime: '', maxRuntime: '' });
});

test('runtime: interior writes concrete minutes', () => {
  assert.deepEqual(runtimeFiltersFromRange(90, 180), { minRuntime: '90', maxRuntime: '180' });
});

test('readout: the default rating floor announces itself', () => {
  assert.equal(formatRatingRange('7', '10.0'), '7+');
});

test('readout: no rating bound reads as Any', () => {
  assert.equal(formatRatingRange('0', '10.0'), 'Any rating');
});

test('readout: an interior rating reads as a range', () => {
  assert.equal(formatRatingRange('6.5', '8'), '6.5 – 8');
  assert.equal(formatRatingRange('0', '8'), 'Up to 8');
});

test('readout: year', () => {
  const now = new Date('2026-08-01');
  assert.equal(formatYearRange('', '', now), 'Any year');
  assert.equal(formatYearRange('2010', '2024', now), '2010 – 2024');
  assert.equal(formatYearRange('2010', '', now), '2010 – now');
  assert.equal(formatYearRange('', '2000', now), 'Up to 2000');
});

test('readout: runtime', () => {
  assert.equal(formatRuntimeRange('', ''), 'Any length');
  assert.equal(formatRuntimeRange('90', '180'), '90 – 180 min');
  assert.equal(formatRuntimeRange('90', ''), '90+ min');
  assert.equal(formatRuntimeRange('', '120'), 'Up to 120 min');
});
