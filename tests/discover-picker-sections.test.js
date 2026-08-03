import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPickerSections,
  pushRecent,
  POPULAR_LANGUAGE_CODES,
  POPULAR_COUNTRY_CODES,
  ITEM_HEIGHT,
  HEADER_HEIGHT,
} from '../src/lib/discoverPickerSections.js';

// A small stand-in language list (alphabetical, with the "Any" sentinel the real
// fetchLanguages prepends).
const ITEMS = [
  { code: null, label: 'Any Language' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zu', label: 'Zulu' },
];

const codesOf = (rows) => rows.filter((r) => r.type === 'item').map((r) => r.code);
const headersOf = (rows) => rows.filter((r) => r.type === 'header').map((r) => r.label);

// ─── pushRecent ────────────────────────────────────────────────────────────────

test('pushRecent puts the newest code first and dedupes', () => {
  assert.deepEqual(pushRecent(['fr', 'ja'], 'ko'), ['ko', 'fr', 'ja']);
  assert.deepEqual(pushRecent(['fr', 'ja'], 'fr'), ['fr', 'ja']); // moved to front, not duplicated
});

test('pushRecent caps at max (default 6, newest kept)', () => {
  const full = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.deepEqual(pushRecent(full, 'g'), ['g', 'a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(pushRecent(['a', 'b'], 'c', 2), ['c', 'a']);
});

test('pushRecent tolerates a null code and a non-array list', () => {
  assert.deepEqual(pushRecent(undefined, 'ko'), ['ko']);
  assert.deepEqual(pushRecent(['ko'], null), ['ko']);
});

// ─── buildPickerSections: the "Any" sentinel is dropped ─────────────────────────

test('the code:null "Any" sentinel never becomes a row (clear lives in the header now)', () => {
  const { rows } = buildPickerSections({ items: ITEMS });
  assert.ok(!codesOf(rows).includes(null));
  assert.ok(!rows.some((r) => r.type === 'item' && r.label === 'Any Language'));
});

// ─── buildPickerSections: no pins → plain flat A–Z, no headers ──────────────────

test('with no recents/suggested it degrades to the plain alphabetical list (no lonely header)', () => {
  const { rows } = buildPickerSections({ items: ITEMS });
  assert.deepEqual(headersOf(rows), []);
  assert.deepEqual(codesOf(rows), ['af', 'en', 'fr', 'ja', 'ko', 'zu']);
});

// ─── buildPickerSections: RECENT → SUGGESTED → ALL ordering + de-dup ────────────

test('sections are ordered Recent → Suggested → All, each code appearing once', () => {
  const { rows } = buildPickerSections({
    items: ITEMS,
    recentCodes: ['ko'],
    suggestedCodes: ['en', 'ja', 'ko'], // ko already in Recent → must not repeat
    allLabel: 'ALL LANGUAGES',
  });
  assert.deepEqual(headersOf(rows), ['RECENT', 'SUGGESTED', 'ALL LANGUAGES']);

  // Recent: ko; Suggested: en, ja (ko dropped as already used); All: the rest A–Z.
  assert.deepEqual(codesOf(rows), ['ko', 'en', 'ja', 'af', 'fr', 'zu']);

  // Every code appears exactly once across the whole list.
  const all = codesOf(rows);
  assert.equal(new Set(all).size, all.length);
});

test('suggested codes not present in items are skipped silently', () => {
  const { rows } = buildPickerSections({
    items: ITEMS,
    suggestedCodes: ['en', 'xx', 'ko'], // xx isn't a real option
    allLabel: 'ALL LANGUAGES',
  });
  assert.deepEqual(codesOf(rows).filter((c) => c === 'xx'), []);
  assert.ok(codesOf(rows).includes('en'));
});

// ─── buildPickerSections: search collapses to flat matches ──────────────────────

test('a query collapses sections to a flat, header-less match list', () => {
  const { rows } = buildPickerSections({
    items: ITEMS,
    recentCodes: ['ko'],
    suggestedCodes: ['en'],
    query: 'an', // afrik-AAN-s, jap-AN-ese, kore-AN
  });
  assert.deepEqual(headersOf(rows), []);
  assert.deepEqual(codesOf(rows).sort(), ['af', 'ja', 'ko']);
});

test('search is case-insensitive and trims whitespace', () => {
  const { rows } = buildPickerSections({ items: ITEMS, query: '  KORE ' });
  assert.deepEqual(codesOf(rows), ['ko']);
});

// ─── buildPickerSections: layout table matches row heights ──────────────────────

test('layout table gives each row the right height and a running offset', () => {
  const { rows, layout } = buildPickerSections({
    items: ITEMS,
    recentCodes: ['ko'],
    allLabel: 'ALL LANGUAGES',
  });
  assert.equal(layout.length, rows.length);

  let expectedOffset = 0;
  rows.forEach((row, i) => {
    const expectedLen = row.type === 'header' ? HEADER_HEIGHT : ITEM_HEIGHT;
    assert.equal(layout[i].length, expectedLen);
    assert.equal(layout[i].offset, expectedOffset);
    assert.equal(layout[i].index, i);
    expectedOffset += expectedLen;
  });
});

// ─── the exported popular lists are sane ────────────────────────────────────────

test('popular code lists are non-empty, unique, and lower/upper-cased as expected', () => {
  assert.ok(POPULAR_LANGUAGE_CODES.length > 0);
  assert.equal(new Set(POPULAR_LANGUAGE_CODES).size, POPULAR_LANGUAGE_CODES.length);
  assert.ok(POPULAR_LANGUAGE_CODES.every((c) => c === c.toLowerCase()));

  assert.ok(POPULAR_COUNTRY_CODES.length > 0);
  assert.equal(new Set(POPULAR_COUNTRY_CODES).size, POPULAR_COUNTRY_CODES.length);
  assert.ok(POPULAR_COUNTRY_CODES.every((c) => c === c.toUpperCase()));
});
