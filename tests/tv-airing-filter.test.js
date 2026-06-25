import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIR_DATE_SORT,
  effectiveDiscoverSortBy,
  formatAirDayLabel,
  getAiringWindow,
  isInAiringWindow,
  sortByAirDateAsc,
} from '../src/lib/tvAiringFilter.js';

const wednesday = new Date(2026, 5, 24, 15, 30, 0);

test('getAiringWindow spans today through Sunday in local time', () => {
  const { start, end } = getAiringWindow(wednesday);
  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 5);
  assert.equal(start.getDate(), 24);
  assert.equal(end.getDay(), 0);
  assert.equal(end.getDate(), 28);
});

test('isInAiringWindow accepts today through Sunday and rejects outside range', () => {
  assert.equal(isInAiringWindow('2026-06-24', wednesday), true);
  assert.equal(isInAiringWindow('2026-06-28', wednesday), true);
  assert.equal(isInAiringWindow('2026-06-23', wednesday), false);
  assert.equal(isInAiringWindow('2026-06-29', wednesday), false);
  assert.equal(isInAiringWindow('', wednesday), false);
});

test('formatAirDayLabel uses Today, Tomorrow, then weekday names', () => {
  assert.equal(formatAirDayLabel('2026-06-24', wednesday), 'Today');
  assert.equal(formatAirDayLabel('2026-06-25', wednesday), 'Tomorrow');
  assert.equal(formatAirDayLabel('2026-06-28', wednesday), 'Sunday');
});

test('sortByAirDateAsc orders soonest first with title tie-break', () => {
  const sorted = sortByAirDateAsc([
    { title: 'Beta', airDate: '2026-06-26' },
    { title: 'Alpha', airDate: '2026-06-24' },
    { title: 'Gamma', airDate: '2026-06-26' },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.title),
    ['Alpha', 'Beta', 'Gamma'],
  );
});

test('effectiveDiscoverSortBy maps client air-date sort to TMDB popularity', () => {
  assert.equal(effectiveDiscoverSortBy(AIR_DATE_SORT), 'popularity.desc');
  assert.equal(effectiveDiscoverSortBy('vote_average.desc'), 'vote_average.desc');
});

test('isInAiringWindow on Sunday only includes Sunday', () => {
  const sunday = new Date(2026, 5, 28, 10, 0, 0);
  assert.equal(isInAiringWindow('2026-06-28', sunday), true);
  assert.equal(isInAiringWindow('2026-06-27', sunday), false);
  assert.equal(isInAiringWindow('2026-06-29', sunday), false);
});
