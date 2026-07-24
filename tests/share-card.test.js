import test from 'node:test';
import assert from 'node:assert/strict';

import { createQrMatrix, QR_MAX_BYTES } from '../src/lib/qrMatrix.js';
import { buildTitleWebUrl, buildTitleDeepLink, parseTitleUrl } from '../src/lib/shareLinks.js';
import {
  pickCountries,
  buildDefaultSelectedCountries,
  buildCountryIndex,
  filterCountryCodes,
  collapseCountryList,
  getAvailableCountriesForService,
  shortName,
} from '../src/lib/shareUtils.js';

const QR_SIZE = 29;

function isFinder(matrix, row, col) {
  // Outer ring dark, one light ring, solid 3×3 core.
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const onOuterRing = r === 0 || r === 6 || c === 0 || c === 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const expected = onOuterRing || inCore;
      if (matrix[row + r][col + c] !== expected) return false;
    }
  }
  return true;
}

test('QR matrix is version 3 (29×29) with well-formed function patterns', () => {
  const matrix = createQrMatrix('https://www.themoviedb.org/movie/550');
  assert.ok(matrix, 'expected a matrix');
  assert.strictEqual(matrix.length, QR_SIZE);
  matrix.forEach((row) => assert.strictEqual(row.length, QR_SIZE));

  assert.ok(isFinder(matrix, 0, 0), 'top-left finder');
  assert.ok(isFinder(matrix, 0, QR_SIZE - 7), 'top-right finder');
  assert.ok(isFinder(matrix, QR_SIZE - 7, 0), 'bottom-left finder');

  // Timing patterns alternate, starting dark at index 8.
  for (let i = 8; i < QR_SIZE - 8; i += 1) {
    assert.strictEqual(matrix[6][i], i % 2 === 0, `horizontal timing at ${i}`);
    assert.strictEqual(matrix[i][6], i % 2 === 0, `vertical timing at ${i}`);
  }

  // Alignment pattern centred at (22, 22) for version 3.
  assert.strictEqual(matrix[22][22], true, 'alignment centre');
  assert.strictEqual(matrix[21][21], false, 'alignment light ring');
  assert.strictEqual(matrix[20][20], true, 'alignment outer ring');

  // Mandatory dark module at (4 * version + 9, 8).
  assert.strictEqual(matrix[21][8], true, 'dark module');
});

/**
 * Read the matrix back the way a scanner does: walk the same zigzag placement,
 * undo mask 0, then parse mode + length + bytes. This is the check that the
 * version 2 → 3 bump did not shift the data region — structure assertions alone
 * would still pass on a matrix whose payload decodes to garbage.
 */
function decodeQr(matrix) {
  const reserved = Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(false));
  const reserve = (row, col) => {
    if (row >= 0 && col >= 0 && row < QR_SIZE && col < QR_SIZE) reserved[row][col] = true;
  };

  // Finders + separators, format strips, timing, alignment, dark module.
  [
    [0, 0],
    [0, QR_SIZE - 7],
    [QR_SIZE - 7, 0],
  ].forEach(([r, c]) => {
    for (let dr = -1; dr <= 7; dr += 1) for (let dc = -1; dc <= 7; dc += 1) reserve(r + dr, c + dc);
  });
  for (let i = 0; i < QR_SIZE; i += 1) {
    reserve(6, i);
    reserve(i, 6);
  }
  // Format info only occupies the two strips at each end of row 8 / column 8 —
  // the modules between them carry data.
  for (let i = 0; i <= 8; i += 1) {
    reserve(8, i);
    reserve(i, 8);
  }
  for (let i = QR_SIZE - 8; i < QR_SIZE; i += 1) {
    reserve(8, i);
    reserve(i, 8);
  }
  for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) reserve(22 + dr, 22 + dc);

  const bits = [];
  let upward = true;
  for (let col = QR_SIZE - 1; col > 0; col -= 2) {
    const c0 = col === 6 ? col - 1 : col;
    for (let step = 0; step < QR_SIZE; step += 1) {
      const row = upward ? QR_SIZE - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const currentCol = c0 - offset;
        if (reserved[row][currentCol]) continue;
        const masked = matrix[row][currentCol] ? 1 : 0;
        bits.push(masked ^ ((row + currentCol) % 2 === 0 ? 1 : 0));
      }
    }
    upward = !upward;
  }

  const take = (count, from) =>
    bits.slice(from, from + count).reduce((acc, bit) => (acc << 1) | bit, 0);

  assert.strictEqual(take(4, 0), 0b0100, 'byte mode');
  const length = take(8, 4);
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(take(8, 12 + i * 8));
  return out;
}

test('QR round-trips: a scanner reads back exactly the URL we encoded', () => {
  for (const url of [
    'https://www.themoviedb.org/movie/550',
    'https://www.themoviedb.org/tv/1396',
    'https://www.themoviedb.org/movie/1234567',
  ]) {
    assert.strictEqual(decodeQr(createQrMatrix(url)), url, url);
  }
});

test('QR capacity fits every TMDb title URL, and over-long payloads are refused', () => {
  // Worst realistic case: a 7-digit TMDb id.
  const longest = buildTitleWebUrl({ tmdbId: 1234567, mediaType: 'movie' });
  assert.strictEqual(longest.length, 40);
  assert.ok(longest.length <= QR_MAX_BYTES, `${longest.length} must fit in ${QR_MAX_BYTES}`);
  assert.ok(createQrMatrix(longest), 'a full-length TMDb URL still encodes');

  // Never silently truncate — that produced a scannable QR pointing nowhere.
  assert.strictEqual(createQrMatrix('x'.repeat(QR_MAX_BYTES + 1)), null);
  assert.strictEqual(createQrMatrix(''), null);
  assert.strictEqual(createQrMatrix(null), null);
});

test('share URLs are built for the right media type and are parseable round-trip', () => {
  assert.strictEqual(
    buildTitleWebUrl({ tmdbId: 550, mediaType: 'movie' }),
    'https://www.themoviedb.org/movie/550',
  );
  assert.strictEqual(
    buildTitleWebUrl({ tmdbId: 1396, mediaType: 'tv' }),
    'https://www.themoviedb.org/tv/1396',
  );
  assert.strictEqual(buildTitleWebUrl({ mediaType: 'tv' }), null);

  assert.deepStrictEqual(parseTitleUrl(buildTitleWebUrl({ tmdbId: 550, mediaType: 'movie' })), {
    mediaType: 'movie',
    tmdbId: '550',
  });
  assert.deepStrictEqual(parseTitleUrl(buildTitleDeepLink({ tmdbId: 1396, mediaType: 'tv' })), {
    mediaType: 'tv',
    tmdbId: '1396',
  });
});

test('deep link parser ignores anything that is not a title link', () => {
  assert.strictEqual(parseTitleUrl('trova://settings'), null);
  assert.strictEqual(parseTitleUrl('trova://title/person/42'), null);
  assert.strictEqual(parseTitleUrl('https://example.com/movie/550'), null);
  assert.strictEqual(parseTitleUrl(''), null);
  assert.strictEqual(parseTitleUrl(undefined), null);
});

test('an explicitly emptied service is distinguishable from an unset one', () => {
  const rows = [
    { code: 'US', providers: { netflix: true } },
    { code: 'CA', providers: { netflix: true, max: true } },
  ];
  const providerSummary = [
    { key: 'netflix', label: 'Netflix', count: 2 },
    { key: 'max', label: 'Max', count: 1 },
  ];

  const defaults = buildDefaultSelectedCountries(providerSummary, rows);
  assert.deepStrictEqual(defaults.netflix, ['US', 'CA']);
  assert.deepStrictEqual(defaults.max, ['CA']);

  // The card's resolution rule: present-but-empty means "the user cleared this",
  // absent means "fall back to auto-pick".
  const resolve = (selection, key) =>
    selection && Object.prototype.hasOwnProperty.call(selection, key)
      ? selection[key] || []
      : pickCountries(rows, key);

  assert.deepStrictEqual(resolve({ netflix: [] }, 'netflix'), [], 'cleared stays cleared');
  assert.deepStrictEqual(resolve({}, 'netflix'), ['US', 'CA'], 'unset auto-picks');
  assert.deepStrictEqual(resolve(undefined, 'netflix'), ['US', 'CA'], 'no selection auto-picks');
});

/** Rows as resolveMatch builds them: TMDb's English name alongside the code. */
const LABEL_ROWS = [
  { code: 'US', country: 'United States of America', providers: { netflix: true } },
  { code: 'GB', country: 'United Kingdom', providers: { netflix: true } },
  { code: 'BA', country: 'Bosnia and Herzegovina', providers: { netflix: true } },
  { code: 'AZ', country: 'Azerbaijan', providers: { netflix: true } },
  { code: 'XX', country: 'XX', providers: { netflix: true } },
];

test('countries outside SHORT_COUNTRY_NAMES get a real name, not a bare ISO code', () => {
  const { labels } = buildCountryIndex(LABEL_ROWS);

  // Hand-written short names still win — the card has no room for the long form.
  assert.strictEqual(shortName('US', labels), 'USA');
  assert.strictEqual(shortName('GB', labels), 'UK');

  // Previously these rendered as "BA" and "AZ".
  assert.strictEqual(shortName('BA', labels), 'Bosnia and Herzegovina');
  assert.strictEqual(shortName('AZ', labels), 'Azerbaijan');

  // Unknown to TMDb as well: the code is the last resort, not the first.
  assert.strictEqual(shortName('XX', labels), 'XX');
  assert.strictEqual(shortName('ZZ', labels), 'ZZ');

  // Callers without an index keep the old behaviour.
  assert.strictEqual(shortName('US'), 'USA');
  assert.strictEqual(shortName('BA'), 'BA');
});

test('country search matches short name, full name and code', () => {
  const index = buildCountryIndex(LABEL_ROWS);
  const codes = getAvailableCountriesForService(LABEL_ROWS, 'netflix');

  const filter = (q) => filterCountryCodes(codes, q, index);

  // Full name is searchable even where a short name overrides the display.
  assert.deepStrictEqual(filter('united'), ['US', 'GB']);
  assert.deepStrictEqual(filter('usa'), ['US']);
  assert.deepStrictEqual(filter('herzegovina'), ['BA']);
  assert.deepStrictEqual(filter('az'), ['AZ']);
  assert.strictEqual(filter('  ').length, codes.length, 'blank query filters nothing');
  assert.deepStrictEqual(filter('nowhere'), []);
});

test('a collapsed service shows the popular head plus any off-list selection', () => {
  const codes = ['US', 'CA', 'GB', 'AU', 'DE', 'NG'];

  assert.deepStrictEqual(collapseCountryList(codes, [], 3), ['US', 'CA', 'GB']);

  // NG is past the head — without pinning it would be selected but invisible,
  // and so impossible to clear.
  assert.deepStrictEqual(collapseCountryList(codes, ['US', 'NG'], 3), ['US', 'CA', 'GB', 'NG']);

  // No duplicates when the selection is already in the head.
  assert.deepStrictEqual(collapseCountryList(codes, ['CA'], 3), ['US', 'CA', 'GB']);

  // A selection the service does not offer is not smuggled in.
  assert.deepStrictEqual(collapseCountryList(codes, ['JP'], 3), ['US', 'CA', 'GB']);

  // Short lists are returned whole.
  assert.deepStrictEqual(collapseCountryList(codes, [], 10), codes);
  assert.deepStrictEqual(collapseCountryList([], ['US'], 3), []);
});
