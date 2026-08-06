import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTvmazeEpisode,
  formatNextEpisodeLabel,
} from '../src/lib/tvmaze.js';

// The label converts to device-local time/locale, so tests derive the expected
// day/time pieces with the same Intl options rather than hardcoding strings —
// this keeps them correct on any machine while still pinning branch behavior.
const dayName = (d) => d.toLocaleDateString(undefined, { weekday: 'long' });
const monthDay = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const localTime = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

test('normalizeTvmazeEpisode keeps the schedule fields and drops undatable payloads', () => {
  const raw = {
    name: 'Cold Harbor',
    season: 2,
    number: 10,
    airdate: '2026-08-06',
    airtime: '21:00',
    airstamp: '2026-08-07T01:00:00+00:00',
    runtime: 75,
    extra: 'ignored',
  };
  assert.deepEqual(normalizeTvmazeEpisode(raw), {
    name: 'Cold Harbor',
    season: 2,
    number: 10,
    airdate: '2026-08-06',
    airtime: '21:00',
    airstamp: '2026-08-07T01:00:00+00:00',
  });

  assert.equal(normalizeTvmazeEpisode(null), null);
  assert.equal(normalizeTvmazeEpisode({}), null);
  assert.equal(normalizeTvmazeEpisode({ name: 'No date' }), null);
});

test('formatNextEpisodeLabel returns null when there is no episode', () => {
  assert.equal(formatNextEpisodeLabel(null), null);
  assert.equal(formatNextEpisodeLabel(undefined), null);
});

test('network episode today shows the local air time', () => {
  const now = new Date(2026, 7, 5, 8, 0); // Aug 5 2026, 08:00 local
  const airstamp = new Date(2026, 7, 5, 21, 35).toISOString(); // 9:35pm local today
  const label = formatNextEpisodeLabel({ airstamp, airdate: '2026-08-05', airtime: '21:35' }, now);
  assert.equal(label, `Next Today, ${localTime(airstamp)}`);
});

test('network episode tomorrow labels the day and time', () => {
  const now = new Date(2026, 7, 5, 8, 0);
  const airstamp = new Date(2026, 7, 6, 20, 0).toISOString();
  const label = formatNextEpisodeLabel({ airstamp, airdate: '2026-08-06', airtime: '20:00' }, now);
  assert.equal(label, `Next Tomorrow, ${localTime(airstamp)}`);
});

test('network episode within the week uses the weekday name', () => {
  const now = new Date(2026, 7, 5, 8, 0);
  const air = new Date(2026, 7, 8, 20, 0); // 3 days out
  const airstamp = air.toISOString();
  const label = formatNextEpisodeLabel({ airstamp, airdate: '2026-08-08', airtime: '20:00' }, now);
  assert.equal(label, `Next ${dayName(air)}, ${localTime(airstamp)}`);
});

test('streaming drop (no airtime) shows the day but never an invented time', () => {
  const now = new Date(2026, 7, 5, 8, 0);
  // Placeholder noon-UTC airstamp, blank airtime — the TVmaze streaming signature.
  const label = formatNextEpisodeLabel(
    { airstamp: '2026-09-20T12:00:00+00:00', airdate: '2026-09-20', airtime: '' },
    now,
  );
  assert.equal(label, `Next ${monthDay(new Date(2026, 8, 20))}`);
  assert.ok(!/\d{1,2}:\d{2}/.test(label), 'must not contain a time');
});

test('far-future date in a different year includes the year', () => {
  const now = new Date(2026, 7, 5, 8, 0);
  const label = formatNextEpisodeLabel(
    { airstamp: null, airdate: '2027-01-15', airtime: '' },
    now,
  );
  const expected = new Date(2027, 0, 15).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  assert.equal(label, `Next ${expected}`);
});
