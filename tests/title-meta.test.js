import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTitleDetailRows, spokenRuntime } from '../src/lib/titleMeta.js';

test('spokenRuntime says hours and minutes as words', () => {
  assert.equal(spokenRuntime(148), '2 hours 28 minutes');
  assert.equal(spokenRuntime(114), '1 hour 54 minutes');
});

test('spokenRuntime drops the empty half of the phrase', () => {
  assert.equal(spokenRuntime(120), '2 hours');
  assert.equal(spokenRuntime(54), '54 minutes');
  assert.equal(spokenRuntime(61), '1 hour 1 minute');
});

test('spokenRuntime returns null for missing or nonsense runtimes', () => {
  assert.equal(spokenRuntime(0), null);
  assert.equal(spokenRuntime(null), null);
  assert.equal(spokenRuntime(undefined), null);
  assert.equal(spokenRuntime(-30), null);
  assert.equal(spokenRuntime('abc'), null);
});

test('buildTitleDetailRows singularises each label independently', () => {
  const rows = buildTitleDetailRows({
    languages: ['English'],
    countries: ['United States', 'United Kingdom'],
  });
  assert.deepEqual(rows, [
    { key: 'language', label: 'Language', value: 'English' },
    { key: 'country', label: 'Countries', value: 'United States, United Kingdom' },
  ]);
});

test('buildTitleDetailRows de-duplicates and preserves Wikidata order', () => {
  const rows = buildTitleDetailRows({
    languages: ['French', 'English', 'French', '  English  '],
    countries: [],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, 'French, English');
});

test('buildTitleDetailRows drops blanks and non-strings', () => {
  const rows = buildTitleDetailRows({
    languages: ['', '   ', null, 42, 'Japanese'],
    countries: ['Japan'],
  });
  assert.equal(rows[0].value, 'Japanese');
  assert.equal(rows[0].label, 'Language');
  assert.equal(rows[1].value, 'Japan');
});

test('buildTitleDetailRows returns nothing to render when there is nothing to say', () => {
  // The caller keys "render no section at all" off an empty array, so the
  // absent / empty / malformed cases must all collapse to the same answer.
  assert.deepEqual(buildTitleDetailRows({ languages: [], countries: [] }), []);
  assert.deepEqual(buildTitleDetailRows({}), []);
  assert.deepEqual(buildTitleDetailRows(null), []);
  assert.deepEqual(buildTitleDetailRows(undefined), []);
  assert.deepEqual(buildTitleDetailRows({ languages: 'English' }), []);
});

test('buildTitleDetailRows renders country alone when language is missing', () => {
  const rows = buildTitleDetailRows({ countries: ['Ireland'] });
  assert.deepEqual(rows, [{ key: 'country', label: 'Country', value: 'Ireland' }]);
});
