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
  formatRuntimeHours,
  formatSeasonsRange,
  formatSeasonsCountLabel,
  seasonsLowFromFilters,
  seasonsHighFromFilters,
  seasonsFiltersFromRange,
  SEASONS_MIN,
  SEASONS_MAX,
  getYearMode,
  getRuntimeMode,
  getRatingMode,
  getSeasonsMode,
  getSeasonsSubMode,
  matchesSeasonsRange,
  TV_STATUS_PRESETS,
  getTvStatusMode,
  formatTvStatus,
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

test('runtime: low thumb at 0 writes empty min and concrete max', () => {
  assert.deepEqual(runtimeFiltersFromRange(0, 90), { minRuntime: '', maxRuntime: '90' });
});

test('runtime: high thumb at ceiling writes concrete min and empty max', () => {
  assert.deepEqual(runtimeFiltersFromRange(90, RUNTIME_MAX), { minRuntime: '90', maxRuntime: '' });
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

test('readout: exact year, runtime and rating', () => {
  assert.equal(formatYearRange('1999', '1999'), '1999');
  assert.equal(formatRuntimeRange('105', '105'), '105 min');
  assert.equal(formatRatingRange('7.3', '7.3'), '7.3');
});

test('formatRuntimeHours formats minutes into hours and minutes', () => {
  assert.equal(formatRuntimeHours(45), '45m');
  assert.equal(formatRuntimeHours(60), '1h');
  assert.equal(formatRuntimeHours(90), '1h 30m');
  assert.equal(formatRuntimeHours(105), '1h 45m');
  assert.equal(formatRuntimeHours(120), '2h');
  assert.equal(formatRuntimeHours(150), '2h 30m');
});

test('getYearMode detects mode correctly', () => {
  assert.equal(getYearMode('', ''), 'ANY');
  assert.equal(getYearMode('1999', '1999'), 'EXACT');
  assert.equal(getYearMode('2010', ''), 'AFTER');
  assert.equal(getYearMode('', '1980'), 'BEFORE');
  assert.equal(getYearMode('1980', '1990'), 'BETWEEN');
});

test('getRuntimeMode detects mode correctly', () => {
  assert.equal(getRuntimeMode('', ''), 'ANY');
  assert.equal(getRuntimeMode('', '90'), 'UNDER');
  assert.equal(getRuntimeMode('120', ''), 'OVER');
  assert.equal(getRuntimeMode('90', '120'), 'BETWEEN');
});

test('getRatingMode detects presets and custom', () => {
  assert.equal(getRatingMode('0', '10.0'), 'ANY');
  assert.equal(getRatingMode('6.0', '10.0'), '6.0+');
  assert.equal(getRatingMode('7', '10.0'), '7.0+');
  assert.equal(getRatingMode('7.0', '10.0'), '7.0+');
  assert.equal(getRatingMode('8.0', '10.0'), '8.0+');
  assert.equal(getRatingMode('7.3', '10.0'), 'CUSTOM');
  assert.equal(getRatingMode('6.5', '8.5'), 'CUSTOM');
});

test('seasons: empty maps to [SEASONS_MIN, SEASONS_MAX] and writes back empty', () => {
  assert.equal(seasonsLowFromFilters(''), SEASONS_MIN);
  assert.equal(seasonsHighFromFilters(''), SEASONS_MAX);
  assert.deepEqual(seasonsFiltersFromRange(SEASONS_MIN, SEASONS_MAX), {
    minSeasons: '',
    maxSeasons: '',
  });
});

test('seasons: formatSeasonsRange formats exact, long, capped, and range bounds', () => {
  assert.equal(formatSeasonsRange('', ''), 'Any seasons');
  assert.equal(formatSeasonsRange('1', '1'), '1 season');
  assert.equal(formatSeasonsRange('3', '3'), '3 seasons');
  assert.equal(formatSeasonsRange('5', ''), '5+ seasons');
  assert.equal(formatSeasonsRange('', '3'), 'Up to 3 seasons');
  assert.equal(formatSeasonsRange('2', '5'), '2 – 5 seasons');
  assert.equal(formatSeasonsCountLabel(1), '1 season');
  assert.equal(formatSeasonsCountLabel(3), '3 seasons');
  assert.equal(formatSeasonsCountLabel(0), null);
});

test('seasons: getSeasonsMode and getSeasonsSubMode detect presets and sub-modes', () => {
  assert.equal(getSeasonsMode('', ''), 'ANY');
  assert.equal(getSeasonsMode('1', '1'), '1');
  assert.equal(getSeasonsMode('2', '2'), '2');
  assert.equal(getSeasonsMode('3', '3'), '3');
  assert.equal(getSeasonsMode('5', ''), '5+');
  assert.equal(getSeasonsMode('4', '4'), 'CUSTOM');
  assert.equal(getSeasonsMode('2', '6'), 'CUSTOM');
  assert.equal(getSeasonsMode('8', ''), 'CUSTOM');

  assert.equal(getSeasonsSubMode('4', '4'), 'EXACT');
  assert.equal(getSeasonsSubMode('5', ''), 'OVER');
  assert.equal(getSeasonsSubMode('', '3'), 'UNDER');
  assert.equal(getSeasonsSubMode('2', '6'), 'BETWEEN');
});

test('seasons: matchesSeasonsRange filters TV show season counts accurately', () => {
  assert.equal(matchesSeasonsRange(1, '', ''), true);
  assert.equal(matchesSeasonsRange(null, '', ''), true);

  // Exact 1 season
  assert.equal(matchesSeasonsRange(1, '1', '1'), true);
  assert.equal(matchesSeasonsRange(2, '1', '1'), false);

  // Exact 3 seasons
  assert.equal(matchesSeasonsRange(3, '3', '3'), true);
  assert.equal(matchesSeasonsRange(2, '3', '3'), false);
  assert.equal(matchesSeasonsRange(4, '3', '3'), false);

  // Long seasons (5+)
  assert.equal(matchesSeasonsRange(5, '5', ''), true);
  assert.equal(matchesSeasonsRange(12, '5', ''), true);
  assert.equal(matchesSeasonsRange(4, '5', ''), false);

  // Between 2 and 4 seasons
  assert.equal(matchesSeasonsRange(1, '2', '4'), false);
  assert.equal(matchesSeasonsRange(2, '2', '4'), true);
  assert.equal(matchesSeasonsRange(3, '2', '4'), true);
  assert.equal(matchesSeasonsRange(4, '2', '4'), true);
  assert.equal(matchesSeasonsRange(5, '2', '4'), false);
});

test('status: getTvStatusMode and formatTvStatus detect presets and formats', () => {
  assert.equal(getTvStatusMode(''), 'ANY');
  assert.equal(getTvStatusMode('all'), 'ANY');
  assert.equal(getTvStatusMode(null), 'ANY');
  assert.equal(getTvStatusMode('returning'), 'RETURNING');
  assert.equal(getTvStatusMode('0'), 'RETURNING');
  assert.equal(getTvStatusMode('ended'), 'ENDED');
  assert.equal(getTvStatusMode('3'), 'ENDED');

  assert.equal(formatTvStatus(''), 'Any status');
  assert.equal(formatTvStatus('all'), 'Any status');
  assert.equal(formatTvStatus('returning'), 'Returning series');
  assert.equal(formatTvStatus('0'), 'Returning series');
  assert.equal(formatTvStatus('ended'), 'Ended');
  assert.equal(formatTvStatus('3'), 'Ended');

  assert.equal(TV_STATUS_PRESETS.length, 3);
  assert.deepEqual(
    TV_STATUS_PRESETS.map((p) => p.id),
    ['ANY', 'RETURNING', 'ENDED'],
  );
});
