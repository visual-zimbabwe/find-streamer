import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RELEASED,
  UPCOMING,
  UNSCHEDULED,
  FRANCHISE_RAIL_CAP,
  isoDay,
  releaseStateFor,
  summarizeFranchise,
  franchiseCountLabel,
  franchiseTileMeta,
  franchiseTileA11yLabel,
  franchiseRailWindow,
} from '../src/lib/franchise.js';

// Fixed clock so "upcoming" never quietly becomes "released" as the suite ages.
const NOW = new Date(2026, 6, 27).getTime(); // 2026-07-27, local

const part = (tmdbId, title, releaseDate, year) => ({
  tmdbId,
  title,
  releaseDate,
  year: year ?? (releaseDate ? releaseDate.slice(0, 4) : 'N/A'),
});

// The real Avatar collection as the app renders it: three films that exist and
// two that TMDb lists with dates years out. The badge used to read "5 films".
const AVATAR = [
  part(19995, 'Avatar', '2009-12-15'),
  part(76600, 'Avatar: The Way of Water', '2022-12-14'),
  part(83533, 'Avatar: Fire and Ash', '2025-12-17'),
  part(216527, 'Avatar 4', '2029-12-19'),
  part(393209, 'Avatar 5', '2031-12-17'),
];

const bondCollection = () =>
  Array.from({ length: 27 }, (_, index) =>
    part(index + 1, `Bond ${index + 1}`, `19${62 + index}-01-01`),
  );

test('releaseStateFor reads a past date as released', () => {
  assert.equal(releaseStateFor(part(1, 'Avatar', '2009-12-15'), NOW), RELEASED);
});

test('releaseStateFor reads a future date as upcoming', () => {
  assert.equal(releaseStateFor(part(1, 'Avatar 5', '2031-12-17'), NOW), UPCOMING);
});

test('releaseStateFor counts today as released', () => {
  assert.equal(releaseStateFor(part(1, 'Today', isoDay(NOW)), NOW), RELEASED);
});

test('releaseStateFor treats a missing or partial date as unscheduled', () => {
  assert.equal(releaseStateFor(part(1, 'Zootopia 3', null), NOW), UNSCHEDULED);
  assert.equal(releaseStateFor(part(1, 'Untitled Sequel', ''), NOW), UNSCHEDULED);
  assert.equal(releaseStateFor(part(1, 'Partial', '2029'), NOW), UNSCHEDULED);
  assert.equal(releaseStateFor(undefined, NOW), UNSCHEDULED);
});

test('summarizeFranchise separates what exists from what does not', () => {
  assert.deepEqual(summarizeFranchise(AVATAR, NOW), {
    total: 5,
    released: 3,
    upcoming: 2,
    unscheduled: 0,
    pending: 2,
  });
});

test('summarizeFranchise counts announced-but-undated entries as pending', () => {
  const mortalKombat = [
    part(460465, 'Mortal Kombat', '2021-04-07'),
    part(1197306, 'Mortal Kombat II', '2026-05-15'),
    part(1400000, 'Mortal Kombat III', null),
  ];
  const summary = summarizeFranchise(mortalKombat, NOW);
  assert.equal(summary.released, 2);
  assert.equal(summary.unscheduled, 1);
  assert.equal(summary.pending, 1);
});

test('franchiseCountLabel states released and upcoming films separately', () => {
  assert.equal(franchiseCountLabel(AVATAR, NOW), '3 films · 2 upcoming');
});

test('franchiseCountLabel drops the second clause when everything is out', () => {
  assert.equal(franchiseCountLabel(AVATAR.slice(0, 3), NOW), '3 films');
});

test('franchiseCountLabel uses the singular', () => {
  assert.equal(franchiseCountLabel(AVATAR.slice(0, 1), NOW), '1 film');
});

test('franchiseCountLabel leads with upcoming when nothing has come out yet', () => {
  const unreleased = [part(1, 'Michael', '2026-10-02'), part(2, 'Untitled Michael Sequel', null)];
  assert.equal(franchiseCountLabel(unreleased, NOW), '2 upcoming films');
});

test('franchiseCountLabel returns nothing for an empty collection', () => {
  assert.equal(franchiseCountLabel([], NOW), '');
});

test('franchiseTileMeta marks the current title even when it is unreleased', () => {
  assert.equal(franchiseTileMeta({ year: '2026', state: UPCOMING, isCurrent: true }), '2026 · Current');
});

test('franchiseTileMeta labels an upcoming film', () => {
  assert.equal(
    franchiseTileMeta({ year: '2031', state: UPCOMING, isCurrent: false }),
    '2031 · Upcoming',
  );
});

test('franchiseTileMeta says TBA rather than N/A when there is no date', () => {
  assert.equal(franchiseTileMeta({ year: 'N/A', state: UNSCHEDULED, isCurrent: false }), 'Date TBA');
});

test('franchiseTileMeta shows a bare year for a released film', () => {
  assert.equal(franchiseTileMeta({ year: '2009', state: RELEASED, isCurrent: false }), '2009');
});

test('franchiseTileMeta never prints "N/A · Current"', () => {
  assert.equal(franchiseTileMeta({ year: 'N/A', state: UNSCHEDULED, isCurrent: true }), 'Current');
});

test('franchiseTileA11yLabel announces the position a collapsed touchable hides', () => {
  assert.equal(
    franchiseTileA11yLabel({
      title: 'Dr. No',
      order: 1,
      total: 27,
      year: '1962',
      state: RELEASED,
      isCurrent: false,
    }),
    '1 of 27. Dr. No, 1962. Open details.',
  );
});

test('franchiseTileA11yLabel announces the current title as such', () => {
  assert.equal(
    franchiseTileA11yLabel({
      title: 'Skyfall',
      order: 24,
      total: 27,
      year: '2012',
      state: RELEASED,
      isCurrent: true,
    }),
    '24 of 27. Skyfall, 2012. Current title.',
  );
});

test('franchiseTileA11yLabel announces release state', () => {
  assert.equal(
    franchiseTileA11yLabel({
      title: 'Avatar 5',
      order: 5,
      total: 5,
      year: '2031',
      state: UPCOMING,
      isCurrent: false,
    }),
    '5 of 5. Avatar 5, upcoming 2031. Open details.',
  );
  assert.equal(
    franchiseTileA11yLabel({
      title: 'Bond 26',
      order: 27,
      total: 27,
      year: 'N/A',
      state: UNSCHEDULED,
      isCurrent: false,
    }),
    '27 of 27. Bond 26, release date to be announced. Open details.',
  );
});

test('franchiseRailWindow returns everything for a short collection', () => {
  const result = franchiseRailWindow(AVATAR, 19995);
  assert.equal(result.items.length, 5);
  assert.equal(result.hasMore, false);
  assert.equal(result.start, 0);
  assert.equal(result.currentWindowIndex, 0);
  assert.deepEqual(
    result.items.map((item) => item.order),
    [1, 2, 3, 4, 5],
  );
});

test('franchiseRailWindow always contains the current title, even at 24 of 27', () => {
  // A head slice would have shown Dr. No..Moonraker and hidden Skyfall entirely.
  const bond = bondCollection();
  const skyfall = bond[23].tmdbId;
  const result = franchiseRailWindow(bond, skyfall);

  assert.equal(result.items.length, FRANCHISE_RAIL_CAP);
  assert.equal(result.hasMore, true);
  assert.equal(result.total, 27);
  assert.ok(result.items.some((item) => item.tmdbId === skyfall));
  // Near the end of the list the lead clamps, so the window is the last ten.
  assert.equal(result.start, 17);
  assert.equal(result.currentWindowIndex, 6);
  // Badges state position in the FULL collection, not in the window.
  assert.equal(result.items[0].order, 18);
  assert.equal(result.items[result.items.length - 1].order, 27);
});

test('franchiseRailWindow keeps lead context when the current title is mid-list', () => {
  const long = bondCollection();
  const result = franchiseRailWindow(long, long[9].tmdbId); // 10th of 27
  assert.equal(result.start, 7);
  assert.equal(result.items[0].order, 8);
  assert.equal(result.currentWindowIndex, 2);
});

test('franchiseRailWindow clamps the window to the end of the list', () => {
  const bond = bondCollection();
  const result = franchiseRailWindow(bond, bond[26].tmdbId);
  assert.equal(result.start, 17);
  assert.equal(result.items[result.items.length - 1].order, 27);
  assert.equal(result.currentWindowIndex, 9);
});

test('franchiseRailWindow falls back to the head when the current title is absent', () => {
  const result = franchiseRailWindow(bondCollection(), 999999);
  assert.equal(result.start, 0);
  assert.equal(result.currentWindowIndex, -1);
  assert.equal(result.items[0].order, 1);
});

test('franchiseRailWindow handles an empty collection', () => {
  const result = franchiseRailWindow([], 1);
  assert.deepEqual(result.items, []);
  assert.equal(result.hasMore, false);
  assert.equal(result.total, 0);
});
